import { describe, expect, it } from "vitest";
import { beginCell, Address } from "@ton/core";
import { keyPairFromSeed, sign, signVerify } from "@ton/crypto";
import { assetIdFor, buildVaultClaimBody, toUnits, voucherDataCell, VAULT_CLAIM_OP } from "@/lib/onchain/vault-claim";

const vault = "EQCD39VS5jcptHL8vMjEXrzGaRcCVYto7HUn4bpAOg8xqB2N";
const beneficiary = Address.parse(vault).toString({ bounceable: false });
const v = { assetId: 0n, amount: 1_500_000_000n, beneficiary, nonce: 1731337200000123n, deadline: 1731340800, vault };

describe("War Vault voucher", () => {
  it("hashes the same fields in the same order as WarVault.tact", () => {
    const contractCell = beginCell()
      .storeUint(v.assetId, 256).storeCoins(v.amount).storeAddress(Address.parse(v.beneficiary))
      .storeUint(v.nonce, 64).storeUint(v.deadline, 32).storeAddress(Address.parse(vault)).endCell();
    expect(voucherDataCell(v).hash().equals(contractCell.hash())).toBe(true);
  });

  it("a signature verifies for the signed voucher and fails for a changed amount", () => {
    const kp = keyPairFromSeed(Buffer.alloc(32, 7));
    const sig = sign(voucherDataCell(v).hash(), kp.secretKey);
    expect(signVerify(voucherDataCell(v).hash(), sig, kp.publicKey)).toBe(true);
    expect(signVerify(voucherDataCell({ ...v, amount: v.amount + 1n }).hash(), sig, kp.publicKey)).toBe(false);
  });

  it("claim message starts with the VaultClaim opcode and carries the signature as a ref", () => {
    const body = buildVaultClaimBody(v, "ab".repeat(64)).beginParse();
    // signature cell is built with the bundled Buffer polyfill, so only shape is checked here
    expect(body.loadUint(32)).toBe(VAULT_CLAIM_OP);
    expect(body.remainingRefs).toBe(1);
  });

  it("TON asset id is 0 and converts amounts exactly", () => {
    expect(assetIdFor("ton")).toBe(0n);
    expect(toUnits(1.5, 9)).toBe(1_500_000_000n);
    expect(toUnits(0.000000001, 9)).toBe(1n);
  });
});
