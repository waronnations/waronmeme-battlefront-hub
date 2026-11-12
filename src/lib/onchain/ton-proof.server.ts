/** Server side of ton_proof: signed one-time payloads + chain public-key lookup. */
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { Buffer } from "buffer";
import { verifyTonProof, PROOF_MAX_AGE_SEC, type TonProofInput, type VerifyResult } from "./ton-proof";

function secret(): string {
  const s = process.env["SESSION_SECRET"];
  if (s && s.length >= 32) return s;
  if (process.env.NODE_ENV !== "production") return "dev-session-secret-must-be-at-least-32-chars-long!!";
  throw new Error("SESSION_SECRET must be set");
}

function mac(body: string) {
  return createHmac("sha256", secret()).update(`tonproof:${body}`).digest("hex").slice(0, 32);
}

/** Payload = <expiry hex><random hex><mac>; stateless and tamper-proof. */
export function issueProofPayload(nowSec = Math.floor(Date.now() / 1000)): string {
  const body = (nowSec + PROOF_MAX_AGE_SEC).toString(16).padStart(8, "0") + randomBytes(8).toString("hex");
  return body + mac(body);
}

const used = new Map<string, number>();

export function checkProofPayload(payload: string, nowSec = Math.floor(Date.now() / 1000)): string | null {
  if (!/^[0-9a-f]{56}$/.test(payload)) return "proof_payload_invalid";
  const body = payload.slice(0, 24);
  const got = Buffer.from(payload.slice(24), "hex");
  const want = Buffer.from(mac(body), "hex");
  if (got.length !== want.length || !timingSafeEqual(got, want)) return "proof_payload_invalid";
  if (parseInt(body.slice(0, 8), 16) < nowSec) return "proof_payload_expired";
  for (const [k, exp] of used) if (exp < nowSec) used.delete(k);
  if (used.has(payload)) return "proof_payload_reused";
  return null;
}

function markUsed(payload: string) {
  used.set(payload, parseInt(payload.slice(0, 8), 16));
}

async function lookupPublicKey(rawAddress: string): Promise<Buffer | null> {
  const net = process.env["TON_NETWORK"] === "testnet" ? "testnet." : "";
  const key = process.env["TONAPI_KEY"];
  try {
    const res = await fetch(`https://${net}tonapi.io/v2/accounts/${encodeURIComponent(rawAddress)}/publickey`, {
      headers: key ? { Authorization: `Bearer ${key}` } : {},
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return null;
    const json = (await res.json()) as { public_key?: string };
    return json.public_key && /^[0-9a-f]{64}$/i.test(json.public_key) ? Buffer.from(json.public_key, "hex") : null;
  } catch {
    return null;
  }
}

/** Verifies a wallet proof end to end; the payload can be used once. */
export async function verifyWalletProof(input: TonProofInput): Promise<VerifyResult> {
  const bad = checkProofPayload(input.proof.payload);
  if (bad) return { ok: false, reason: bad };
  const extra = (process.env["PROOF_DOMAINS"] ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const res = await verifyTonProof(input, { extraDomains: extra, lookupPublicKey });
  if (res.ok) markUsed(input.proof.payload);
  return res;
}
