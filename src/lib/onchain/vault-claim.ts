/**
 * War Vault voucher cells — shared by the server signer and the browser
 * transaction builder. Must match contracts/WarVault.tact exactly.
 */
import { Buffer } from "buffer";

const g = globalThis as unknown as { Buffer?: typeof Buffer };
if (!g.Buffer) g.Buffer = Buffer;

import { Address, beginCell, toNano } from "@ton/core";

export const VAULT_CLAIM_OP = 0x5641554c; // "VAUL"
/** Gas the player attaches; unused value is returned by the wallet contract flow. */
export const VAULT_CLAIM_GAS_TON = "0.12";

export type VaultVoucher = {
  assetId: bigint;
  amount: bigint;
  beneficiary: string;
  nonce: bigint;
  deadline: number;
  vault: string;
};

/** 0 for native TON, otherwise the jetton master's 256-bit address hash. */
export function assetIdFor(assetKey: string): bigint {
  if (assetKey === "ton") return 0n;
  const hash = Address.parse(assetKey).hash;
  return BigInt(`0x${Buffer.from(hash).toString("hex")}`);
}

export function voucherDataCell(v: VaultVoucher) {
  return beginCell()
    .storeUint(v.assetId, 256)
    .storeCoins(v.amount)
    .storeAddress(Address.parse(v.beneficiary))
    .storeUint(v.nonce, 64)
    .storeUint(v.deadline, 32)
    .storeAddress(Address.parse(v.vault))
    .endCell();
}

export function toUnits(amount: number, decimals: number): bigint {
  const [whole, frac = ""] = amount.toFixed(Math.min(9, decimals)).split(".");
  return BigInt(whole! + frac.padEnd(decimals, "0").slice(0, decimals));
}

function hexToBuffer(hex: string): Buffer {
  const h = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (h.length !== 128) throw new Error("signature must be 64 bytes");
  // Use the runtime's global Buffer so @ton/core accepts it (Node or polyfill).
  const B = (globalThis as unknown as { Buffer: typeof Buffer }).Buffer;
  return B.from(h, "hex");
}

export function buildVaultClaimBody(v: Omit<VaultVoucher, "vault">, signatureHex: string) {
  return beginCell()
    .storeUint(VAULT_CLAIM_OP, 32)
    .storeUint(v.assetId, 256)
    .storeCoins(v.amount)
    .storeAddress(Address.parse(v.beneficiary))
    .storeUint(v.nonce, 64)
    .storeUint(v.deadline, 32)
    .storeRef(beginCell().storeBuffer(hexToBuffer(signatureHex)).endCell())
    .endCell();
}

/** TON Connect transaction for a signed voucher. */
export function buildVaultClaimTx(v: {
  vault: string;
  assetId: string;
  amount: string;
  beneficiary: string;
  nonce: string;
  deadline: number;
  signatureHex: string;
}) {
  const body = buildVaultClaimBody(
    { assetId: BigInt(v.assetId), amount: BigInt(v.amount), beneficiary: v.beneficiary, nonce: BigInt(v.nonce), deadline: v.deadline },
    v.signatureHex,
  );
  return {
    validUntil: Math.min(v.deadline, Math.floor(Date.now() / 1000) + 600),
    messages: [
      {
        address: Address.parse(v.vault).toString({ bounceable: true }),
        amount: toNano(VAULT_CLAIM_GAS_TON).toString(),
        payload: body.toBoc().toString("base64"),
      },
    ],
  };
}
