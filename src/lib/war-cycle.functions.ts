// War cycle: tiered board, strategies, conviction, Apocalypse, packs and wealth ranks.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId, sessionUserId, loadUser } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import { PACK_SIZES } from "@/lib/packs/packs";

const tier = z.enum(["recruit", "captain", "admiral"]);
const strategySchema = z.object({
  name: z.string().min(1).max(40),
  horizon: z.enum(["short", "medium", "bullrun"]),
  tiers: z.array(tier).min(1),
  maxPositionPct: z.number().min(1).max(100),
  holdUntilApocalypse: z.boolean(),
  autoNuke: z.boolean(),
});

/** Public market board; works without the database. */
export const getTierBoardFn = createServerFn({ method: "GET" }).handler(async () => {
  const { boardByTier } = await import("@/lib/war-cycle/cycle.server");
  try {
    return { board: await boardByTier(), error: null };
  } catch (e) {
    console.error(e);
    return { board: { recruit: [], captain: [], admiral: [] }, error: "Market data is unavailable right now" };
  }
});

export const getPackPoolFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ tier: z.union([tier, z.literal("any")]) }).parse(i))
  .handler(async ({ data }) => {
    const { getMarketCoins } = await import("@/lib/market/market.server");
    const { eligibleCoins } = await import("@/lib/packs/packs");
    try {
      return { coins: eligibleCoins(await getMarketCoins(), data.tier).slice(0, 150), error: null };
    } catch {
      return { coins: [], error: "Market data is unavailable right now" };
    }
  });

export const getApocalypseFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return { available: false as const, standings: [] };
  await ensureSchema();
  const { apocalypseStandings } = await import("@/lib/war-cycle/cycle.server");
  try {
    return { available: true as const, standings: await apocalypseStandings() };
  } catch {
    return { available: true as const, standings: [] };
  }
});

export const getStrategiesFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return { available: false as const, strategies: [] };
  await ensureSchema();
  const uid = await sessionUserId();
  if (!uid) return { available: false as const, strategies: [] };
  const { listStrategies } = await import("@/lib/war-cycle/cycle.server");
  return { available: true as const, strategies: await listStrategies(uid) };
});

export const saveStrategyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => strategySchema.parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, strategies: [], error: null };
    await ensureSchema();
    const uid = await requireUserId();
    assertRateLimit(`strat:${uid}`, 10, 60_000);
    const { saveStrategy } = await import("@/lib/war-cycle/cycle.server");
    try {
      return { available: true as const, strategies: await saveStrategy(uid, data), error: null };
    } catch (e) {
      return { available: true as const, strategies: [], error: e instanceof Error ? e.message : "Failed" };
    }
  });

export const activateStrategyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.number().int().positive(), agent: z.boolean() }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, strategies: [] };
    await ensureSchema();
    const uid = await requireUserId();
    const { activateStrategy } = await import("@/lib/war-cycle/cycle.server");
    return { available: true as const, strategies: await activateStrategy(uid, data.id, data.agent) };
  });

export const deleteStrategyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ id: z.number().int().positive() }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, strategies: [] };
    await ensureSchema();
    const uid = await requireUserId();
    const { deleteStrategy } = await import("@/lib/war-cycle/cycle.server");
    return { available: true as const, strategies: await deleteStrategy(uid, data.id) };
  });

export const setConvictionFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ coinMaster: z.string().min(40).max(80), amount: z.number().min(0) }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const };
    await ensureSchema();
    const uid = await requireUserId();
    assertRateLimit(`conv:${uid}`, 20, 60_000);
    const { setConviction } = await import("@/lib/war-cycle/cycle.server");
    await setConviction(uid, data.coinMaster, data.amount);
    return { available: true as const };
  });

export const preparePackFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        size: z.union([z.literal(10), z.literal(20), z.literal(50), z.literal(100)]),
        tier: z.union([tier, z.literal("any")]),
        masters: z.array(z.string().min(40).max(80)).max(Math.max(...PACK_SIZES)),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, error: "Saving isn't available yet" };
    await ensureSchema();
    const uid = await requireUserId();
    assertRateLimit(`pack:${uid}`, 5, 60_000);
    const wallet = (await loadUser(uid))?.walletAddress ?? null;
    if (!wallet) return { available: true as const, error: "Connect your TON wallet first" };
    try {
      const { preparePack } = await import("@/lib/war-cycle/cycle.server");
      const { buildPackTransactions } = await import("@/lib/packs/packs.server");
      const order = await preparePack(uid, data.size, data.tier, data.masters);
      const { txs } = await buildPackTransactions(uid, order.orderId, wallet);
      return { available: true as const, order, txs };
    } catch (e) {
      return { available: true as const, error: e instanceof Error ? e.message : "Couldn't prepare pack" };
    }
  });

export const markPackSentFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ orderId: z.number().int().positive(), sent: z.number().int().min(0), total: z.number().int().min(1) }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { ok: false };
    await ensureSchema();
    const uid = await requireUserId();
    const { markPackSent } = await import("@/lib/packs/packs.server");
    await markPackSent(uid, data.orderId, data.sent, data.total);
    if (data.sent >= data.total) {
      const { ensureVaultTables, fundFromPack } = await import("@/lib/vault/vault.server");
      await ensureVaultTables()
        .then(() => fundFromPack(data.orderId))
        .catch((e) => console.error("pool funding failed", e));
    }
    return { ok: true };
  });

export const getWealthFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ nationId: z.number().int().positive().nullable() }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, me: null, board: [] };
    await ensureSchema();
    const { wealthLeaderboard, myWealth } = await import("@/lib/wealth/wealth.server");
    const uid = await sessionUserId();
    return {
      available: true as const,
      me: uid ? await myWealth(uid) : null,
      board: await wealthLeaderboard(data.nationId),
    };
  });
