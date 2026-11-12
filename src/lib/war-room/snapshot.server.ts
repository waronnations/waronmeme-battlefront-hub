// Public War Room snapshot: market sectors, radiation, Doomsday clock, apex
// standings, prize pools and recent activity. Shared by the War Room page and
// the public agent tools, so it returns only data that is already public:
// callsigns, aggregated totals and masked wallet addresses.
import type { MarketCoin } from "@/lib/war-cycle/cycle";
import { apexStandings, doomsdayClock, radiationLevel } from "@/lib/apocalypse/engine";
import { factionSectors, totalVolume } from "./sectors";

const mask = (w: string) => (w.length > 10 ? `${w.slice(0, 4)}…${w.slice(-4)}` : w);

async function coinsOrEmpty(): Promise<{ coins: MarketCoin[]; error: string | null }> {
  try {
    const { getMarketCoins } = await import("@/lib/market/market.server");
    return { coins: await getMarketCoins(), error: null };
  } catch (e) {
    console.error(e);
    return { coins: [], error: "Market data is unavailable right now" };
  }
}

async function withDb<T>(fallback: T, fn: () => Promise<T>): Promise<T> {
  try {
    const { hasDatabase, ensureSchema } = await import("@/lib/db.server");
    if (!hasDatabase()) return fallback;
    await ensureSchema();
    return await fn();
  } catch (e) {
    console.error(e);
    return fallback;
  }
}

export async function convictionHolders(): Promise<Map<string, number>> {
  return withDb(new Map<string, number>(), async () => {
    const { apocalypseStandings } = await import("@/lib/war-cycle/cycle.server");
    const rows = await apocalypseStandings();
    return new Map(rows.map((r: { master: string; convictionHolders: number }) => [r.master, r.convictionHolders]));
  });
}

export async function battlefieldState(now = Date.now()) {
  const { coins, error } = await coinsOrEmpty();
  const sectors = factionSectors(coins);
  const factionVolumeUsd = totalVolume(sectors);
  const radiation = radiationLevel({ now, coins, factionVolumeUsd });
  const combat = await withDb([] as { attacker: string; victim: string; weapon: string; hit: boolean; glory: number; at: number }[], async () => {
    const { listOpsKillFeed } = await import("@/lib/battlefield.server");
    return (await listOpsKillFeed(12)).map((k) => ({ attacker: k.attackerName, victim: k.victimName, weapon: k.weaponId, hit: k.hit, glory: k.gloryGained, at: k.createdAt }));
  });
  return { generatedAt: now, error, sectors, factionVolumeUsd, marketVolumeUsd: coins.reduce((s, c) => s + c.volume24hUsd, 0), radiation, combat };
}

export async function apocalypseTimer(now = Date.now()) {
  let coins: MarketCoin[] = [];
  try {
    const { boardByTier } = await import("@/lib/war-cycle/cycle.server");
    const b = await boardByTier();
    coins = [...b.admiral, ...b.captain, ...b.recruit];
  } catch (e) {
    console.error(e);
  }
  const clock = doomsdayClock(now);
  const standings = apexStandings(coins, await convictionHolders(), 5);
  return {
    msLeft: clock.msLeft,
    detonated: clock.detonated,
    parts: clock.parts,
    survivors: standings.map((s, i) => ({ rank: i + 1, symbol: s.symbol, master: s.master, score: Math.round(s.score), share: s.share, convictionHolders: s.convictionHolders })),
  };
}

export async function vaultStatus() {
  return withDb({ available: false, cycleKey: "", battleAt: 0, pools: [] as { symbol: string; amount: number }[], recentClaims: [] as { symbol: string; claims: number; amount: number }[], landlords: [] as { wallet: string; pixels: number }[] }, async () => {
    const { sql } = await import("@/lib/db.server");
    const { ensureVaultTables, currentPools, listVaultAssets } = await import("@/lib/vault/vault.server");
    await ensureVaultTables();
    const pools = await currentPools();
    const assets = await listVaultAssets();
    const sym = new Map(assets.map((a) => [a.key, a.symbol]));
    const claims = await sql`
      SELECT asset_key, COUNT(*)::int AS n, COALESCE(SUM(amount), 0)::float8 AS total
      FROM vault_vouchers WHERE status IN ('sent','paid') AND created_at > NOW() - INTERVAL '7 days'
      GROUP BY asset_key`;
    const land = await sql`SELECT wallet, tonmap_pixels FROM holder_perks WHERE tonmap_pixels > 0 ORDER BY tonmap_pixels DESC LIMIT 5`;
    return {
      available: true,
      cycleKey: pools.cycleKey,
      battleAt: pools.battleAt,
      pools: pools.pools.map((p) => ({ symbol: p.symbol, amount: p.amount })),
      recentClaims: claims.rows.map((r) => ({ symbol: sym.get(String(r["asset_key"])) ?? String(r["asset_key"]), claims: Number(r["n"]), amount: Number(r["total"]) })),
      landlords: land.rows.map((r) => ({ wallet: mask(String(r["wallet"])), pixels: Number(r["tonmap_pixels"]) })),
    };
  });
}

export async function warRoomSnapshot(now = Date.now()) {
  const [battle, timer, vault] = await Promise.all([battlefieldState(now), apocalypseTimer(now), vaultStatus()]);
  return { ...battle, timer, vault };
}
