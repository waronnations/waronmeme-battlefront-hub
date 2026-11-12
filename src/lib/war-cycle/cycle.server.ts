import { sql } from "@/lib/db/client.server";
import { getMarketCoins } from "@/lib/market/market.server";
import { eligibleCoins, perCoinGram, validateSelection, type PackSize } from "@/lib/packs/packs";
import {
  APOCALYPSE_AT,
  apocalypseScore,
  classifyTier,
  isHealthy,
  validateStrategy,
  type CoinTier,
  type WarStrategy,
} from "./cycle";

export async function boardByTier() {
  const coins = (await getMarketCoins()).filter(isHealthy);
  const out: Record<CoinTier, typeof coins> = { recruit: [], captain: [], admiral: [] };
  for (const c of coins) {
    const t = classifyTier(c.liquidityUsd);
    if (t && out[t].length < 20) out[t].push(c);
  }
  return out;
}

export async function listStrategies(userId: number) {
  const { rows } = await sql`SELECT id, name, config, is_active, agent_enabled FROM war_strategies WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 20`;
  return rows.map((r) => ({
    id: Number(r["id"]),
    config: r["config"] as WarStrategy,
    active: Boolean(r["is_active"]),
    agent: Boolean(r["agent_enabled"]),
  }));
}

export async function saveStrategy(userId: number, s: WarStrategy) {
  const err = validateStrategy(s);
  if (err) throw new Error(err);
  const count = await sql`SELECT COUNT(*)::int AS n FROM war_strategies WHERE user_id = ${userId}`;
  if (Number(count.rows[0]?.["n"]) >= 20) throw new Error("Strategy limit reached (20)");
  await sql`INSERT INTO war_strategies (user_id, name, config) VALUES (${userId}, ${s.name}, ${JSON.stringify(s)}::jsonb)`;
  return listStrategies(userId);
}

export async function activateStrategy(userId: number, id: number, agent: boolean) {
  await sql`UPDATE war_strategies SET is_active = (id = ${id}), agent_enabled = CASE WHEN id = ${id} THEN ${agent} ELSE FALSE END WHERE user_id = ${userId}`;
  return listStrategies(userId);
}

export async function deleteStrategy(userId: number, id: number) {
  await sql`DELETE FROM war_strategies WHERE user_id = ${userId} AND id = ${id}`;
  return listStrategies(userId);
}

/** Players declare conviction holdings; amounts are re-verified on-chain at Apocalypse. */
export async function setConviction(userId: number, coinMaster: string, amount: number) {
  await sql`
    INSERT INTO conviction_positions (user_id, coin_master, amount) VALUES (${userId}, ${coinMaster}, ${amount})
    ON CONFLICT (user_id, coin_master) DO UPDATE SET
      amount = EXCLUDED.amount, updated_at = NOW(),
      held_since = CASE WHEN EXCLUDED.amount < conviction_positions.amount THEN NOW() ELSE conviction_positions.held_since END`;
}

export async function apocalypseStandings() {
  const coins = await getMarketCoins();
  const { rows } = await sql`SELECT coin_master, COUNT(*)::int AS holders FROM conviction_positions WHERE amount > 0 GROUP BY coin_master`;
  const holders = new Map(rows.map((r) => [String(r["coin_master"]), Number(r["holders"])]));
  return coins
    .filter((c) => isHealthy(c) && classifyTier(c.liquidityUsd))
    .map((c) => {
      const cand = { master: c.master, convictionHolders: holders.get(c.master) ?? 0, liquidityUsd: c.liquidityUsd, volume24hUsd: c.volume24hUsd };
      return { ...cand, symbol: c.symbol, image: c.image, score: apocalypseScore(cand) };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map((x) => ({ ...x, apocalypseAt: APOCALYPSE_AT }));
}

export async function preparePack(userId: number, size: PackSize, tier: CoinTier | "any", masters: string[]) {
  const pool = eligibleCoins(await getMarketCoins(), tier);
  const err = validateSelection(masters, pool, size);
  if (err) throw new Error(err);
  const each = perCoinGram(size);
  const coins = masters.map((m) => {
    const c = pool.find((x) => x.master === m)!;
    return { master: m, symbol: c.symbol, gram: each };
  });
  const { PACK_PRICE_GRAM } = await import("@/lib/packs/packs");
  const ins = await sql`INSERT INTO pack_orders (user_id, size, price_gram, coins) VALUES (${userId}, ${size}, ${PACK_PRICE_GRAM[size]}, ${JSON.stringify(coins)}::jsonb) RETURNING id`;
  return { orderId: Number(ins.rows[0]?.["id"]), coins, priceGram: PACK_PRICE_GRAM[size] };
}
