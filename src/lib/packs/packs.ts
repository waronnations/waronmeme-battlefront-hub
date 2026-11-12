// Smart memecoin packs. Pure.
import { classifyTier, isHealthy, type CoinTier, type MarketCoin } from "@/lib/war-cycle/cycle";

export const PACK_SIZES = [10, 20, 50, 100] as const;
export type PackSize = (typeof PACK_SIZES)[number];
/** Price in GRAM per pack size. */
export const PACK_PRICE_GRAM: Record<PackSize, number> = { 10: 10, 20: 18, 50: 40, 100: 75 };

export function eligibleCoins(coins: MarketCoin[], tier: CoinTier | "any", minVolume = 0): MarketCoin[] {
  return coins.filter(
    (c) => isHealthy(c) && c.volume24hUsd >= minVolume && (tier === "any" || classifyTier(c.liquidityUsd) === tier),
  );
}

function rng(seed: number) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Random distinct coins, weighted toward liquidity. */
export function randomPack(pool: MarketCoin[], size: number, seed: number): MarketCoin[] {
  const r = rng(seed);
  const items = pool.map((c) => ({ c, k: Math.pow(r(), 1 / Math.max(1, Math.log10(1 + c.liquidityUsd))) }));
  return items.sort((a, b) => b.k - a.k).slice(0, size).map((x) => x.c);
}

export function validateSelection(selected: string[], pool: MarketCoin[], size: PackSize): string | null {
  const allowed = new Set(pool.map((c) => c.master));
  if (new Set(selected).size !== selected.length) return "Duplicate coins in bag";
  if (selected.length !== size) return `Pick exactly ${size} coins`;
  if (selected.some((m) => !allowed.has(m))) return "A selected coin is not eligible";
  return null;
}

/** GRAM per coin in the pack (equal split). */
export function perCoinGram(size: PackSize): number {
  return PACK_PRICE_GRAM[size] / size;
}
