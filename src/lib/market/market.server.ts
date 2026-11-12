// Live TON memecoin market data from STON.fi (assets + pools), cached in memory.
import type { MarketCoin } from "@/lib/war-cycle/cycle";

const TON_ADDR = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
const TTL_MS = 10 * 60_000;
let cache: { at: number; coins: MarketCoin[]; tonUsd: number } | null = null;

type StonAsset = {
  contract_address: string;
  symbol: string;
  display_name?: string;
  image_url?: string;
  dex_price_usd?: string;
  dex_usd_price?: string;
  blacklisted?: boolean;
  taxable?: boolean;
  deprecated?: boolean;
  kind?: string;
  tags?: string[];
};
type StonPool = {
  token0_address: string;
  token1_address: string;
  lp_total_supply_usd?: string;
  volume_24h_usd?: string;
  deprecated?: boolean;
};

export async function getMarketCoins(): Promise<MarketCoin[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.coins;
  const [aRes, pRes] = await Promise.all([
    fetch("https://api.ston.fi/v1/assets"),
    fetch("https://api.ston.fi/v1/pools?dex_v2=false"),
  ]);
  if (!aRes.ok || !pRes.ok) throw new Error(`Market data unavailable (${aRes.status}/${pRes.status})`);
  const assets = ((await aRes.json()) as { asset_list: StonAsset[] }).asset_list;
  const pools = ((await pRes.json()) as { pool_list: StonPool[] }).pool_list;

  const liq = new Map<string, { l: number; v: number }>();
  for (const p of pools) {
    if (p.deprecated) continue;
    const other = p.token0_address === TON_ADDR ? p.token1_address : p.token1_address === TON_ADDR ? p.token0_address : null;
    if (!other) continue;
    const cur = liq.get(other) ?? { l: 0, v: 0 };
    cur.l += Number(p.lp_total_supply_usd ?? 0);
    cur.v += Number(p.volume_24h_usd ?? 0);
    liq.set(other, cur);
  }

  const coins: MarketCoin[] = [];
  for (const a of assets) {
    if (a.kind !== "Jetton" || a.deprecated) continue;
    if (a.tags?.some((t) => /fake|honeypot|suspicious|scam/.test(t))) continue;
    // Stablecoins and staked/wrapped TON are not memecoins.
    if (/^(j?usd|usdt|usdc|dai|ts?ton|stton|hton|wton|pton)/i.test(a.symbol)) continue;
    const m = liq.get(a.contract_address);
    if (!m) continue;
    coins.push({
      master: a.contract_address,
      symbol: a.symbol,
      name: a.display_name ?? a.symbol,
      image: a.image_url ?? null,
      priceUsd: Number(a.dex_price_usd ?? 0),
      liquidityUsd: m.l,
      volume24hUsd: m.v,
      blacklisted: Boolean(a.blacklisted),
      taxable: Boolean(a.taxable),
    });
  }
  coins.sort((x, y) => y.liquidityUsd - x.liquidityUsd);
  const ton = assets.find((a) => a.contract_address === TON_ADDR);
  const tonUsd = Number(ton?.dex_usd_price ?? ton?.dex_price_usd ?? 0);
  cache = { at: Date.now(), coins, tonUsd: Number.isFinite(tonUsd) ? tonUsd : 0 };
  return coins;
}

/** Native TON price in USD from the same cached STON.fi snapshot (0 when unknown). */
export async function getTonPriceUsd(): Promise<number> {
  await getMarketCoins();
  return cache?.tonUsd ?? 0;
}
