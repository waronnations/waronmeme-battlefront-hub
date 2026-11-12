// contracts/WarVault.tact
// War On Memes — Multi-asset War Vault
// Holds native TON and any TEP-74 jetton (GRAM, memecoins). Players claim
// with a server-signed voucher; each voucher pays one asset once.
//
// Voucher hash = cell(assetId:uint256, amount:coins, beneficiary:address,
//                     nonce:uint64, deadline:uint32, vault:address).hash()
// assetId 0 = native TON; otherwise the jetton master's address hash.

import "@stdlib/ownable";
import "@stdlib/deploy";

message SetPaused { paused: Bool; }
message SetClaimSigner { publicKey: Int as uint256; }
message SetAssetWallet { assetId: Int as uint256; wallet: Address; }
message RemoveAsset { assetId: Int as uint256; }
message Upgrade { code: Cell; }
message Withdraw { assetId: Int as uint256; amount: Int as coins; to: Address; }

message(0x5641554c) VaultClaim {
    assetId: Int as uint256;
    amount: Int as coins;
    beneficiary: Address;
    nonce: Int as uint64;
    deadline: Int as uint32;
    signature: Slice;              // 64-byte Ed25519 signature (stored as a ref)
}

message(0x7362d09c) JettonTransferNotification {
    queryId: Int as uint64;
    amount: Int as coins;
    sender: Address;
    forwardPayload: Slice as remaining;
}

message(0xf8a7ea5) JettonTransfer {
    queryId: Int as uint64;
    amount: Int as coins;
    destination: Address;
    responseDestination: Address?;
    customPayload: Cell?;
    forwardTonAmount: Int as coins;
    forwardPayload: Slice as remaining;
}

const TON_RESERVE: Int = ton("0.5");
const JETTON_FORWARD_GAS: Int = ton("0.05");

contract WarVault with Ownable, Deployable {
    owner: Address;
    claimSigner: Int as uint256;
    paused: Bool = false;
    version: Int as uint32 = 1;

    assetWallets: map<Int as uint256, Address>;   // assetId -> vault's jetton wallet
    walletAssets: map<Address, Int as uint256>;   // reverse lookup for deposits
    balances: map<Int as uint256, Int as coins>;  // jetton balances we know about
    usedNonces: map<Int as uint64, Bool>;

    init(owner: Address, claimSigner: Int as uint256) {
        self.owner = owner;
        self.claimSigner = claimSigner;
    }

    // ── Funding ──────────────────────────────────────────────────────────
    receive() { }                                   // plain TON top-ups

    receive(msg: JettonTransferNotification) {
        let assetId: Int? = self.walletAssets.get(sender());
        if (assetId == null) { return; }            // unknown jetton: ignored, owner can register later
        let prev: Int = self.balances.get(assetId!!) ?: 0;
        self.balances.set(assetId!!, prev + msg.amount);
    }

    // ── Admin ────────────────────────────────────────────────────────────
    receive(msg: SetPaused) { self.requireOwner(); self.paused = msg.paused; }
    receive(msg: SetClaimSigner) { self.requireOwner(); self.claimSigner = msg.publicKey; }

    receive(msg: SetAssetWallet) {
        self.requireOwner();
        require(msg.assetId != 0, "TON needs no wallet");
        self.assetWallets.set(msg.assetId, msg.wallet);
        self.walletAssets.set(msg.wallet, msg.assetId);
    }

    receive(msg: RemoveAsset) {
        self.requireOwner();
        let w: Address? = self.assetWallets.get(msg.assetId);
        if (w != null) { self.walletAssets.set(w!!, null); }
        self.assetWallets.set(msg.assetId, null);
    }

    receive(msg: Withdraw) {
        self.requireOwner();
        self.pay(msg.assetId, msg.amount, msg.to);
    }

    receive(msg: Upgrade) {
        self.requireOwner();
        setCode(msg.code);
        self.version += 1;
    }

    // ── Claim (player pays gas) ──────────────────────────────────────────
    receive(msg: VaultClaim) {
        require(!self.paused, "Vault is paused");
        require(now() <= msg.deadline, "Voucher expired");
        require(msg.amount > 0, "Nothing to claim");
        require(self.usedNonces.get(msg.nonce) == null, "Voucher already used");
        require(sender() == msg.beneficiary, "Only the beneficiary can claim");

        let hash: Int = beginCell()
            .storeUint(msg.assetId, 256)
            .storeCoins(msg.amount)
            .storeAddress(msg.beneficiary)
            .storeUint(msg.nonce, 64)
            .storeUint(msg.deadline, 32)
            .storeAddress(myAddress())
            .endCell()
            .hash();
        require(checkSignature(hash, msg.signature, self.claimSigner), "Bad signature");

        self.usedNonces.set(msg.nonce, true);
        self.pay(msg.assetId, msg.amount, msg.beneficiary);
    }

    fun pay(assetId: Int, amount: Int, to: Address) {
        if (assetId == 0) {
            require(myBalance() - amount >= TON_RESERVE, "Vault TON reserve too low");
            send(SendParameters{ to: to, value: amount, bounce: false, mode: SendIgnoreErrors, body: "War Vault reward".asComment() });
            return;
        }
        let wallet: Address? = self.assetWallets.get(assetId);
        require(wallet != null, "Asset not supported");
        let bal: Int = self.balances.get(assetId) ?: 0;
        require(bal >= amount, "Vault balance too low");
        self.balances.set(assetId, bal - amount);
        send(SendParameters{
            to: wallet!!,
            value: JETTON_FORWARD_GAS,
            bounce: true,
            mode: SendPayGasSeparately,
            body: JettonTransfer{
                queryId: now(),
                amount: amount,
                destination: to,
                responseDestination: to,
                customPayload: null,
                forwardTonAmount: 1,
                forwardPayload: beginCell().storeUint(0, 1).endCell().beginParse()
            }.toCell()
        });
    }

    // ── Getters ──────────────────────────────────────────────────────────
    get fun nonceUsed(nonce: Int): Bool { return self.usedNonces.get(nonce) != null; }
    get fun assetBalance(assetId: Int): Int {
        if (assetId == 0) { return myBalance(); }
        return self.balances.get(assetId) ?: 0;
    }
    get fun assetWallet(assetId: Int): Address? { return self.assetWallets.get(assetId); }
    get fun signer(): Int { return self.claimSigner; }
    get fun isPaused(): Bool { return self.paused; }
    get fun vaultVersion(): Int { return self.version; }
}
