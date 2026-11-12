// War Vault, war chest and holder perks server functions.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId, sessionUserId, loadUser } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";

async function bootVault() {
  if (!hasDatabase()) return false;
  await ensureSchema();
  const { ensureVaultTables } = await import("@/lib/vault/vault.server");
  await ensureVaultTables();
  return true;
}

/** Public: this week's prize pool per asset. */
export const getWarChestFn = createServerFn({ method: "GET" }).handler(async () => {
  const { nextWeeklyBattle } = await import("@/lib/war-cycle/cycle");
  const fallback = { available: false as const, cycleKey: "", battleAt: nextWeeklyBattle(Date.now()), pools: [] as { key: string; symbol: string; amount: number }[] };
  try {
    if (!(await bootVault())) return fallback;
    const { currentPools } = await import("@/lib/vault/vault.server");
    return { available: true as const, ...(await currentPools()) };
  } catch (e) {
    console.error(e);
    return fallback;
  }
});

export const getVaultFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!(await bootVault())) return { available: false as const };
  const uid = await sessionUserId();
  if (!uid) return { available: false as const };
  const { getVault, perksConfigured } = await import("@/lib/vault/vault.server");
  const user = await loadUser(uid);
  return { available: true as const, wallet: user?.walletAddress ?? null, perksConfig: perksConfigured(), ...(await getVault(uid)) };
});

export const claimVaultFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ assetKey: z.string().min(3).max(80) }).parse(i))
  .handler(async ({ data }) => {
    if (!(await bootVault())) return { ok: false as const, error: "Saving isn't available yet" };
    const uid = await requireUserId();
    assertRateLimit(`vault:${uid}`, 5, 60_000);
    const wallet = (await loadUser(uid))?.walletAddress ?? null;
    if (!wallet) return { ok: false as const, error: "Connect your TON wallet first" };
    const { issueVoucher } = await import("@/lib/vault/vault.server");
    try {
      return { ok: true as const, voucher: await issueVoucher(uid, data.assetKey, wallet) };
    } catch (e) {
      return { ok: false as const, error: e instanceof Error ? e.message : "Claim failed" };
    }
  });

export const markVoucherSentFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ nonce: z.string().regex(/^\d{1,20}$/) }).parse(i))
  .handler(async ({ data }) => {
    if (!(await bootVault())) return { ok: false };
    const uid = await requireUserId();
    const { markVoucherSent } = await import("@/lib/vault/vault.server");
    await markVoucherSent(uid, data.nonce);
    return { ok: true };
  });

export const refreshPerksFn = createServerFn({ method: "POST" }).handler(async () => {
  if (!(await bootVault())) return { ok: false as const, error: "Saving isn't available yet" };
  const uid = await requireUserId();
  assertRateLimit(`perks:${uid}`, 4, 60_000);
  const wallet = (await loadUser(uid))?.walletAddress ?? null;
  if (!wallet) return { ok: false as const, error: "Connect your TON wallet first" };
  const { refreshPerks } = await import("@/lib/vault/vault.server");
  try {
    return { ok: true as const, perks: await refreshPerks(uid, wallet) };
  } catch (e) {
    return { ok: false as const, error: e instanceof Error ? e.message : "Wallet check failed" };
  }
});

/** Public: territory radar built from the live market board. */
export const getTerritoryFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getMarketCoins } = await import("@/lib/market/market.server");
  const { isHealthy } = await import("@/lib/war-cycle/cycle");
  const { buildTerritory } = await import("@/lib/territory/territory");
  try {
    const coins = (await getMarketCoins()).filter(isHealthy);
    return { sectors: buildTerritory(coins), error: null };
  } catch {
    return { sectors: [], error: "Market data is unavailable right now" };
  }
});
