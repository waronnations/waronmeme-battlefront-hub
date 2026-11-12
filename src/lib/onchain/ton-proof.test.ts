// @vitest-environment node
import { describe, it, expect } from "vitest";
import { Buffer } from "buffer";
import { beginCell, storeStateInit } from "@ton/core";
import { WalletContractV4 } from "@ton/ton";
import { mnemonicNew, mnemonicToPrivateKey, sign } from "@ton/crypto";
import { verifyTonProof, tonProofMessageHash, type TonProofInput } from "./ton-proof";

async function signedProof(overrides: Partial<TonProofInput["proof"]> = {}, now = 1_800_000_000) {
  const keys = await mnemonicToPrivateKey(await mnemonicNew());
  const wallet = WalletContractV4.create({ workchain: 0, publicKey: keys.publicKey });
  const stateInit = beginCell().store(storeStateInit(wallet.init)).endCell().toBoc().toString("base64");
  const domain = "war.lovable.app";
  const input: TonProofInput = {
    address: wallet.address.toRawString(),
    walletStateInit: stateInit,
    proof: { timestamp: now, domain: { lengthBytes: domain.length, value: domain }, payload: "abc123payload", signature: "", ...overrides },
  };
  const sig = sign(await tonProofMessageHash(input), keys.secretKey);
  input.proof.signature = Buffer.from(sig).toString("base64");
  return { input, keys };
}

describe("ton_proof verification", () => {
  it("accepts a genuine signature from the wallet that owns the address", async () => {
    const { input } = await signedProof();
    expect(await verifyTonProof(input, { nowSec: 1_800_000_010 })).toMatchObject({ ok: true });
  });

  it("rejects a proof whose payload was changed after signing", async () => {
    const { input } = await signedProof();
    input.proof.payload = "different";
    expect(await verifyTonProof(input, { nowSec: 1_800_000_010 })).toEqual({ ok: false, reason: "bad_signature" });
  });

  it("rejects someone else's address with a valid signature from another wallet", async () => {
    const a = await signedProof();
    const b = await signedProof();
    a.input.address = b.input.address;
    expect(await verifyTonProof(a.input, { nowSec: 1_800_000_010 })).toEqual({ ok: false, reason: "state_init_address_mismatch" });
  });

  it("rejects proofs older than 15 minutes", async () => {
    const { input } = await signedProof();
    expect(await verifyTonProof(input, { nowSec: 1_800_000_000 + 15 * 60 + 1 })).toEqual({ ok: false, reason: "proof_expired" });
  });

  it("rejects proofs signed for another site", async () => {
    const { input } = await signedProof({ domain: { lengthBytes: 12, value: "evil.example" } });
    expect(await verifyTonProof(input, { nowSec: 1_800_000_010 })).toEqual({ ok: false, reason: "proof_domain_mismatch" });
  });
});
