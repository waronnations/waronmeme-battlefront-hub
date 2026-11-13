// Bunker LP: pool metrics, fee split and Doomsday liquidity pledges. Pure — safe on server, client and tests.
import { APOCALYPSE_AT } from "@/lib/war-cycle/cycle";

/** STON.fi reports native TON (and pTON) in pools under this address. */
export const TON_ADDRESS = "EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c";
/** LP tokens and TON both use 9 decimals. */
export const LP_DECIMALS = 9;

export const BUNKER_LP_RULES = {
  /** Pledges hold until the Doomsday detonation. */
  until: APOCALYPSE_AT,
  /** Smallest pledge, in USD of LP value, that counts. */
  minPledgeUsd: 10,
  /** How often a pledge's LP balance is re-read from the chain. */
  recheckMs: 30 * 60_000,
  /** Price protection on the LP tokens minted when adding liquidity. */
  slippage: 0.05,
  /** Smallest and largest GRAM side accepted in one add-liquidity transaction. */
  minTon: 0.5,
  maxTon: 10_000,
  /** Pools shallower than this are never supplied: a near-empty pool's price is easy to push around. */
  minPoolTvlUsd: 5_000,
  /** GRAM attached on top of the deposit for the two DEX messages (unused gas is refunded). */
  maxGasTon: 0.8,
} as const;

export type PoolStat = {
  address: string;
  router: string;
  version: 1 | 2;
  /** The coin's side of a TON pool, or null when the pool isn't paired with TON. */
  tonIsToken0: boolean | null;
  reserveTon: string;
  reserveCoin: string;
  lpTotalSupply: string;
  lpFeeBps: number;
  protocolFeeBps: number;
  refFeeBps: number;
  tvlUsd: number;
  volume24hUsd: number;
  lpPriceUsd: number;
  apy1d: number;
  apy7d: number;
  apy30d: number;
  recommended: boolean;
};

export type StonPoolRaw = {
  address: string;
  router_address: string;
  token0_address: string;
  token1_address: string;
  reserve0?: string;
  reserve1?: string;
  lp_total_supply?: string;
  lp_total_supply_usd?: string;
  lp_fee?: string;
  protocol_fee?: string;
  ref_fee?: string;
  lp_price_usd?: string;
  apy_1d?: string;
  apy_7d?: string;
  apy_30d?: string;
  volume_24h_usd?: string | null;
  deprecated?: boolean;
  tags?: string[];
};

const num = (v: unknown) => {
  const n = Number(v ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Normalises one STON.fi pool row for a coin; null when the pool doesn't contain the coin. */
export function poolFromApi(p: StonPoolRaw, coinMaster: string): PoolStat | null {
  if (p.deprecated) return null;
  const has0 = p.token0_address === coinMaster;
  const has1 = p.token1_address === coinMaster;
  if (!has0 && !has1) return null;
  const other = has0 ? p.token1_address : p.token0_address;
  const tonIsToken0 = other === TON_ADDRESS ? has1 : null;
  const tags = p.tags ?? [];
  const version = tags.includes("pool:dex_major_version:2") ? 2 : 1;
  return {
    address: p.address,
    router: p.router_address,
    version,
    tonIsToken0,
    reserveTon: tonIsToken0 === null ? "0" : String(tonIsToken0 ? p.reserve0 ?? "0" : p.reserve1 ?? "0"),
    reserveCoin: String(has0 ? p.reserve0 ?? "0" : p.reserve1 ?? "0"),
    lpTotalSupply: String(p.lp_total_supply ?? "0"),
    lpFeeBps: num(p.lp_fee),
    protocolFeeBps: num(p.protocol_fee),
    refFeeBps: num(p.ref_fee),
    tvlUsd: num(p.lp_total_supply_usd),
    volume24hUsd: num(p.volume_24h_usd),
    lpPriceUsd: num(p.lp_price_usd),
    apy1d: num(p.apy_1d),
    apy7d: num(p.apy_7d),
    apy30d: num(p.apy_30d),
    recommended: !tags.includes("pool:liquidity_provision:not_recommended"),
  };
}

/** The pool bunker deposits go into: deepest recommended v2 TON pool. */
export function bunkerPool(pools: PoolStat[]): PoolStat | null {
  return (
    pools
      .filter((p) => p.version === 2 && p.tonIsToken0 !== null && p.recommended && p.tvlUsd >= BUNKER_LP_RULES.minPoolTvlUsd && BigInt(p.reserveTon || "0") > 0n && BigInt(p.reserveCoin || "0") > 0n)
      .sort((a, b) => b.tvlUsd - a.tvlUsd)[0] ?? null
  );
}

export type CoinLpMetrics = {
  poolCount: number;
  tvlUsd: number;
  volume24hUsd: number;
  /** Volume-weighted swap fee across the coin's pools, in basis points. */
  feeBps: number;
  lpFeeBps: number;
  protocolFeeBps: number;
  /** Share of every swap fee that is paid to liquidity providers (0..1). */
  lpFeeShare: number;
  lpFees24hUsd: number;
  protocolFees24hUsd: number;
  /** Simple yearly fee return for LPs: 24h LP fees × 365 / TVL. */
  feeApr: number;
  /** STON.fi's own 7-day APY for the bunker pool (0 when unknown). */
  apy7d: number;
  /** Daily turnover: 24h volume / TVL. */
  turnover: number;
  bunkerPool: string | null;
  bunkerFeeBps: number;
  bunkerUsd: number;
  bunkerPledgers: number;
  /** Bunker-pledged LP as a share of the bunker pool's TVL (0..1). */
  bunkerShare: number;
  /** Fees the bunker's LP earns per day at today's volume. */
  bunkerFees24hUsd: number;
};

export function coinLpMetrics(pools: PoolStat[], bunker: { usd: number; pledgers: number } = { usd: 0, pledgers: 0 }): CoinLpMetrics {
  const tvlUsd = pools.reduce((s, p) => s + p.tvlUsd, 0);
  const volume24hUsd = pools.reduce((s, p) => s + p.volume24hUsd, 0);
  const lpFees24hUsd = pools.reduce((s, p) => s + (p.volume24hUsd * p.lpFeeBps) / 10_000, 0);
  const protocolFees24hUsd = pools.reduce((s, p) => s + (p.volume24hUsd * p.protocolFeeBps) / 10_000, 0);
  const weight = (f: (p: PoolStat) => number) => {
    const w = pools.reduce((s, p) => s + (p.volume24hUsd > 0 ? p.volume24hUsd : 0), 0);
    if (w > 0) return pools.reduce((s, p) => s + f(p) * Math.max(0, p.volume24hUsd), 0) / w;
    const t = pools.reduce((s, p) => s + p.tvlUsd, 0);
    if (t > 0) return pools.reduce((s, p) => s + f(p) * p.tvlUsd, 0) / t;
    return pools[0] ? f(pools[0]) : 0;
  };
  const lpFeeBps = weight((p) => p.lpFeeBps);
  const protocolFeeBps = weight((p) => p.protocolFeeBps);
  const feeBps = lpFeeBps + protocolFeeBps;
  const main = bunkerPool(pools);
  const bunkerShare = main && main.tvlUsd > 0 ? Math.min(1, bunker.usd / main.tvlUsd) : 0;
  const mainLpFees = main ? (main.volume24hUsd * main.lpFeeBps) / 10_000 : 0;
  return {
    poolCount: pools.length,
    tvlUsd,
    volume24hUsd,
    feeBps,
    lpFeeBps,
    protocolFeeBps,
    lpFeeShare: feeBps > 0 ? lpFeeBps / feeBps : 0,
    lpFees24hUsd,
    protocolFees24hUsd,
    feeApr: tvlUsd > 0 ? (lpFees24hUsd * 365) / tvlUsd : 0,
    apy7d: main?.apy7d ?? 0,
    turnover: tvlUsd > 0 ? volume24hUsd / tvlUsd : 0,
    bunkerPool: main?.address ?? null,
    bunkerFeeBps: main ? main.lpFeeBps + main.protocolFeeBps : 0,
    bunkerUsd: bunker.usd,
    bunkerPledgers: bunker.pledgers,
    bunkerShare,
    bunkerFees24hUsd: mainLpFees * bunkerShare,
  };
}

/** Share of a pool a position owns and the fees it earns per day at today's volume. */
export function positionFees(lpUnits: bigint, pool: Pick<PoolStat, "lpTotalSupply" | "volume24hUsd" | "lpFeeBps" | "lpPriceUsd">) {
  const supply = BigInt(pool.lpTotalSupply || "0");
  const share = supply > 0n ? Number((lpUnits * 1_000_000_000n) / supply) / 1e9 : 0;
  const valueUsd = (Number(lpUnits) / 10 ** LP_DECIMALS) * pool.lpPriceUsd;
  return { share, valueUsd, feesPerDayUsd: ((pool.volume24hUsd * pool.lpFeeBps) / 10_000) * share };
}

/**
 * Two-sided deposit for a constant-product pool: the coin amount that matches `tonNano`
 * at the current reserves, and the LP units expected (with the slippage floor).
 */
export function quoteProvide(pool: Pick<PoolStat, "reserveTon" | "reserveCoin" | "lpTotalSupply">, tonNano: bigint, slippage: number = BUNKER_LP_RULES.slippage) {
  const rTon = BigInt(pool.reserveTon || "0");
  const rCoin = BigInt(pool.reserveCoin || "0");
  const supply = BigInt(pool.lpTotalSupply || "0");
  if (rTon <= 0n || rCoin <= 0n || supply <= 0n || tonNano <= 0n) throw new Error("pool_empty");
  const coinUnits = (tonNano * rCoin + rTon - 1n) / rTon;
  const expectedLp = (tonNano * supply) / rTon;
  const keep = BigInt(Math.round((1 - Math.min(0.5, Math.max(0, slippage))) * 10_000));
  const minLpOut = (expectedLp * keep) / 10_000n;
  return { coinUnits, expectedLp, minLpOut: minLpOut > 0n ? minLpOut : 1n };
}

export type LpMessage = { address: string; amount: string; payload?: string };

/** Refuses an add-liquidity request that would spend more GRAM than the deposit plus gas. */
export function checkLpMessages(messages: LpMessage[], tonNano: bigint, maxGasTon: number = BUNKER_LP_RULES.maxGasTon) {
  if (messages.length < 1 || messages.length > 4) throw new Error("bad_lp_transaction");
  const total = messages.reduce((s, m) => s + BigInt(m.amount), 0n);
  const cap = tonNano + BigInt(Math.round(maxGasTon * 1e9));
  if (total > cap) throw new Error("Liquidity transaction asks for more GRAM than your deposit plus gas");
  if (total < tonNano) throw new Error("Liquidity transaction doesn't carry your full deposit");
  return total;
}

export type PledgeStatus = "holding" | "broken" | "survived" | "fallen";

/**
 * A pledge holds while the wallet keeps at least the pledged LP. After Doomsday it is final:
 * pledges in the apex survivor survive, the rest fall with their coin.
 */
export function pledgeStatus(input: { pledgedUnits: bigint; currentUnits: bigint | null; status: PledgeStatus; now: number; coinMaster: string; apexMaster?: string | null; until?: number }): PledgeStatus {
  const until = input.until ?? BUNKER_LP_RULES.until;
  if (input.status === "broken") return "broken";
  if (input.now < until) {
    if (input.currentUnits !== null && input.currentUnits < input.pledgedUnits) return "broken";
    return "holding";
  }
  if (input.status === "survived" || input.status === "fallen") return input.status;
  if (!input.apexMaster) return "holding";
  return input.apexMaster === input.coinMaster ? "survived" : "fallen";
}

export const fmtBps = (bps: number) => `${(bps / 100).toFixed(bps % 10 === 0 ? 2 : 3).replace(/0+$/, "").replace(/\.$/, "")}%`;

export type LpBoardRow = {
  master: string;
  symbol: string;
  image: string | null;
  priceUsd: number;
  tier: "recruit" | "captain" | "admiral" | "faction";
  metrics: CoinLpMetrics;
  canProvide: boolean;
};
