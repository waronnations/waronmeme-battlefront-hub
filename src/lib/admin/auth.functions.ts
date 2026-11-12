// src/lib/admin/auth.functions.ts
/**
 * Admin auth server functions (session, login, logout).
 * All mutations require a valid admin session (wallet in ADMIN_WALLETS).
 * Re-exported from @/lib/admin.functions.
 */

import { createServerFn } from "@tanstack/react-start";
import { WalletLinkSchema } from "@/lib/auth.server";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import {
  adminLogin,
  adminLogout,
  getAdminSession,
} from "@/lib/admin.server";

// ─── Auth ──────────────────────────────────────────────────────────

export const getAdminSessionFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return { isAdmin: false, wallet: null, userId: null };
  await ensureSchema();
  return getAdminSession();
});

/** One-time code the wallet signs; proves the caller holds the admin wallet. */
export const adminProofPayloadFn = createServerFn({ method: "GET" }).handler(async () => {
  const { issueProofPayload } = await import("@/lib/onchain/ton-proof.server");
  return { payload: issueProofPayload() };
});

export const adminLoginFn = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => WalletLinkSchema.parse(input))
  .handler(async ({ data }) => {
    if (!hasDatabase()) throw new Error("database_unavailable");
    assertRateLimit(`admin:login:${data.address}`, 10, 60_000);
    const { verifyWalletProof } = await import("@/lib/onchain/ton-proof.server");
    const check = await verifyWalletProof(data);
    if (!check.ok) throw new Error(check.reason);
    await ensureSchema();
    return adminLogin(data.address);
  });

export const adminLogoutFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!hasDatabase()) throw new Error("database_unavailable");
  await ensureSchema();
  return adminLogout();
});
