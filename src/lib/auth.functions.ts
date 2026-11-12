import { createServerFn } from "@tanstack/react-start";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import {
  WalletSchema,
  WalletLinkSchema,
  loadUser,
  requireUserId,
  sessionUserId,
  setWallet,
} from "@/lib/auth.server";
import { mutableSession } from "@/lib/session.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

export type { WonUser } from "@/lib/auth.server";

export const getCurrentUser = createServerFn({ method: "GET" }).handler(
  async () => {
    if (!hasDatabase()) return null;
    const userId = await sessionUserId();
    if (!userId) return null;
    await ensureSchema();
    return loadUser(userId);
  },
);

/** One-time code for the wallet to sign before linking. */
export const getTonProofPayload = createServerFn({ method: "GET" }).handler(async () => {
  const { issueProofPayload } = await import("@/lib/onchain/ton-proof.server");
  return { payload: issueProofPayload() };
});

/**
 * Link wallet with full Ed25519 ton_proof verification.
 * Client must send address + proof { timestamp, domain, signature, payload }.
 */
export const linkWallet = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WalletLinkSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_not_configured");
    const userId = await requireUserId();
    assertRateLimit(`wallet:link:${userId}`, 5, 60_000);
    await ensureSchema();

    const { verifyWalletProof } = await import("@/lib/onchain/ton-proof.server");
    const proofCheck = await verifyWalletProof(data);
    if (!proofCheck.ok) throw new Error(proofCheck.reason);

    return setWallet(userId, data.address);
  });

/** Legacy address-only link (disabled for security — use linkWallet with proof). */
export const linkWalletLegacy = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WalletSchema.parse(input))
  .handler(async () => {
    throw new Error("use_linkWallet_with_ton_proof");
  });

export const unlinkWallet = createServerFn({ method: "POST" }).handler(
  async () => {
    if (!hasDatabase()) throw new Error("database_not_configured");
    const userId = await requireUserId();
    assertRateLimit(`wallet:unlink:${userId}`, 5, 60_000);
    await ensureSchema();
    return setWallet(userId, null);
  },
);

export const logout = createServerFn({ method: "POST" }).handler(async () => {
  const session = await mutableSession();
  await session.clear();
  return { ok: true };
});
