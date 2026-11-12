/**
 * TON Connect ton_proof verification (spec: ton-proof-item-v2).
 * Pure apart from the optional chain lookup passed in by the caller,
 * so it runs the same in tests, Node and the Worker.
 */
import "./buffer-polyfill";
import { Buffer } from "buffer";
import { Address, Cell, contractAddress, loadStateInit } from "@ton/core";
import { sha256, signVerify } from "@ton/crypto";

export type TonProofInput = {
  address: string;
  proof: { timestamp: number; domain: { lengthBytes: number; value: string }; signature: string; payload: string };
  publicKey?: string;
  walletStateInit?: string;
};

export const PROOF_MAX_AGE_SEC = 15 * 60;

/** Domains a proof may be signed for. Lovable preview/published hosts are included. */
export const BASE_PROOF_DOMAINS = ["waronnations.vercel.app", "lovable.app", "lovableproject.com", "localhost", "127.0.0.1"];

export function domainAllowed(domain: string, extra: string[] = []): boolean {
  const d = domain.replace(/^https?:\/\//, "").replace(/\/$/, "").replace(/:\d+$/, "").toLowerCase();
  return [...BASE_PROOF_DOMAINS, ...extra].some((a) => d === a || d.endsWith(`.${a}`));
}

/** Reads the Ed25519 public key from a standard wallet's initial data (v3, v4, v5). */
export function publicKeyFromStateInit(stateInitB64: string): { publicKey: Buffer; hash: Buffer } | null {
  try {
    const cell = Cell.fromBase64(stateInitB64);
    const init = loadStateInit(cell.beginParse());
    if (!init.data) return null;
    const data = init.data.beginParse();
    const bits = data.remainingBits;
    let pk: Buffer | null = null;
    if (bits === 32 + 32 + 256 || bits === 32 + 32 + 256 + 1) {
      // v3 / v4: seqno, subwallet, pubkey [, plugins dict flag]
      data.skip(64);
      pk = data.loadBuffer(32);
    } else if (bits === 1 + 32 + 32 + 256 + 1) {
      // v5r1: is_signature_allowed, seqno, wallet_id, pubkey, extensions flag
      data.skip(1 + 64);
      pk = data.loadBuffer(32);
    }
    if (!pk) return null;
    return { publicKey: pk, hash: Buffer.from(contractAddress(0, init).hash) };
  } catch {
    return null;
  }
}

export async function tonProofMessageHash(input: TonProofInput): Promise<Buffer> {
  const addr = Address.parse(input.address);
  const wc = Buffer.alloc(4);
  wc.writeInt32BE(addr.workChain);
  const domLen = Buffer.alloc(4);
  domLen.writeUInt32LE(input.proof.domain.lengthBytes);
  const ts = Buffer.alloc(8);
  ts.writeBigUInt64LE(BigInt(input.proof.timestamp));
  const msg = Buffer.concat([
    Buffer.from("ton-proof-item-v2/"),
    wc,
    Buffer.from(addr.hash),
    domLen,
    Buffer.from(input.proof.domain.value),
    ts,
    Buffer.from(input.proof.payload),
  ]);
  const full = Buffer.concat([Buffer.from([0xff, 0xff]), Buffer.from("ton-connect"), await sha256(msg)]);
  return sha256(full);
}

export type VerifyResult = { ok: true; publicKey: string } | { ok: false; reason: string };

/**
 * Full check: freshness, domain, domain length, address ↔ state-init binding,
 * and the Ed25519 signature. `lookupPublicKey` is used for already-deployed
 * wallets that send no state init.
 */
export async function verifyTonProof(
  input: TonProofInput,
  opts: { nowSec?: number; extraDomains?: string[]; lookupPublicKey?: (address: string) => Promise<Buffer | null> } = {},
): Promise<VerifyResult> {
  const now = opts.nowSec ?? Math.floor(Date.now() / 1000);
  const { proof } = input;
  if (proof.timestamp > now + 60) return { ok: false, reason: "proof_timestamp_future" };
  if (now - proof.timestamp > PROOF_MAX_AGE_SEC) return { ok: false, reason: "proof_expired" };
  if (!domainAllowed(proof.domain.value, opts.extraDomains)) return { ok: false, reason: "proof_domain_mismatch" };
  if (Buffer.byteLength(proof.domain.value) !== proof.domain.lengthBytes) return { ok: false, reason: "proof_domain_length_mismatch" };

  let addr: Address;
  try {
    addr = Address.parse(input.address);
  } catch {
    return { ok: false, reason: "invalid_address" };
  }

  let publicKey: Buffer | null = null;
  if (input.walletStateInit) {
    const parsed = publicKeyFromStateInit(input.walletStateInit);
    if (!parsed) return { ok: false, reason: "unsupported_wallet" };
    if (!parsed.hash.equals(Buffer.from(addr.hash))) return { ok: false, reason: "state_init_address_mismatch" };
    publicKey = parsed.publicKey;
  } else if (opts.lookupPublicKey) {
    publicKey = await opts.lookupPublicKey(addr.toRawString());
  }
  if (!publicKey) return { ok: false, reason: "public_key_unavailable" };
  if (input.publicKey && input.publicKey.toLowerCase() !== publicKey.toString("hex")) {
    return { ok: false, reason: "public_key_mismatch" };
  }

  let sig: Buffer;
  try {
    sig = Buffer.from(proof.signature, "base64");
  } catch {
    return { ok: false, reason: "bad_signature" };
  }
  if (sig.length !== 64) return { ok: false, reason: "bad_signature" };
  const hash = await tonProofMessageHash(input);
  return signVerify(hash, sig, publicKey) ? { ok: true, publicKey: publicKey.toString("hex") } : { ok: false, reason: "bad_signature" };
}
