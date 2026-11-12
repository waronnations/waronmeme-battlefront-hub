// Live prices and pool depth for the quick-swap tokens (STON.fi data). Server-only.
import { getMarketCoins, getTonPriceUsd } from "@/lib/market/market.server";
import { swapAssets, type SwapAssetKey, type PoolMetrics } from "./coffeeswap";

const TTL_MS = 2 * 60_000;
let cache: { at: number; data: SwapMarketSnapshot } | null = null;

export type SwapMarketSnapshot = {
  market: Partial<Record<SwapAssetKey, PoolMetrics & { image: string | null }>>;
  updatedAt: number;
};

type StonAsset = { image_url?: string; dex_price_usd?: string; dex_usd_price?: string };

async function stonAsset(address: string): Promise<StonAsset | null> {
  try {
    const r = await fetch(`https://api.ston.fi/v1/assets/${encodeURIComponent(address)}`);
    if (!r.ok) return null;
    return ((await r.json()) as { asset?: StonAsset }).asset ?? null;
  } catch {
    return null;
  }
}

export async function getSwapMarket(): Promise<SwapMarketSnapshot> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const [coins, tonUsd] = await Promise.all([getMarketCoins(), getTonPriceUsd()]);
  // The native coin (GRAM) is the routing base: hop depth always comes from the jetton side.
  const native = await stonAsset("EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c");
  const market: SwapMarketSnapshot["market"] = { ton: { priceUsd: tonUsd, liquidityUsd: 0, image: native?.image_url ?? null } };
  for (const a of swapAssets()) {
    if (a.key === "ton" || !a.address) continue;
    const coin = coins.find((c) => c.master === a.address);
    if (coin) {
      market[a.key] = { priceUsd: coin.priceUsd, liquidityUsd: coin.liquidityUsd, image: coin.image };
      continue;
    }
    // Not on the healthy board (e.g. no TON pool yet): price and logo only.
    const s = await stonAsset(a.address);
    const price = Number(s?.dex_price_usd ?? s?.dex_usd_price ?? 0);
    market[a.key] = { priceUsd: Number.isFinite(price) ? price : 0, liquidityUsd: 0, image: s?.image_url ?? null };
  }
  const data = { market, updatedAt: Date.now() };
  cache = { at: Date.now(), data };
  return data;
}
