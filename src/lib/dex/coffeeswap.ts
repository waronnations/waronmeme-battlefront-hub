// CoffeeSwap (swap.coffee) quick-swap scaffold (native coin ticker: GRAM, formerly TON): assets, slippage rules,
// simulated constant-product quotes, routes and TonConnect payloads.
// Pure — the live API is only described here, never called from this module.
import { WARCAT_CA, WARDOG_CA } from "@/lib/tokens";

export const COFFEE_API = "https://backend.swap.coffee";
/** swap.coffee's id for native TON. */
export const COFFEE_NATIVE = "native";

/** "ton" is the native coin's internal key; its player-facing ticker is GRAM. */
export type SwapAssetKey = "ton" | "wardog" | "warcat";
export type SwapAsset = {
  key: SwapAssetKey;
  symbol: string;
  name: string;
  /** Jetton master, `native` for the native coin, or null when not linked yet. */
  address: string | null;
  decimals: number;
  side: "base" | "faction";
};

export function swapAssets(): SwapAsset[] {
  return [
    { key: "ton", symbol: "GRAM", name: "Gram", address: COFFEE_NATIVE, decimals: 9, side: "base" },
    { key: "wardog", symbol: "WARDOG", name: "War Dog", address: WARDOG_CA, decimals: 9, side: "faction" },
    { key: "warcat", symbol: "WARCAT", name: "War Cat", address: WARCAT_CA, decimals: 9, side: "faction" },
  ];
}

// ── Slippage ──────────────────────────────────────────────────────────
export const SLIPPAGE_PRESETS_BPS = [50, 100, 300] as const;
export const DEFAULT_SLIPPAGE_BPS = 100;
export const MIN_SLIPPAGE_BPS = 10;
export const MAX_SLIPPAGE_BPS = 2000;
export const HIGH_IMPACT = 0.05;

export function validateSlippage(bps: number): string | null {
  if (!Number.isFinite(bps)) return "Enter a slippage percentage";
  if (bps < MIN_SLIPPAGE_BPS) return `Slippage must be at least ${MIN_SLIPPAGE_BPS / 100}%`;
  if (bps > MAX_SLIPPAGE_BPS) return `Slippage can't exceed ${MAX_SLIPPAGE_BPS / 100}%`;
  return null;
}

// ── Simulated quotes ──────────────────────────────────────────────────
/** DEX pool fee per hop (0.3%). */
export const POOL_FEE_BPS = 30;

export type PoolMetrics = { priceUsd: number; liquidityUsd: number };
export type SwapMarket = Partial<Record<SwapAssetKey, PoolMetrics>>;

/** Every pool on the route pairs with the native coin, so jetton → jetton hops through GRAM. */
export function routeFor(from: SwapAsset, to: SwapAsset, all: SwapAsset[]): SwapAsset[] {
  if (from.key === to.key) return [from];
  if (from.key === "ton" || to.key === "ton") return [from, to];
  const ton = all.find((a) => a.key === "ton")!;
  return [from, ton, to];
}

export type RouteHop = { from: string; to: string; dex: string; feeBps: number };
export type SwapQuote =
  | {
      ok: true;
      amountIn: number;
      amountOut: number;
      minOut: number;
      priceImpact: number;
      feeUsd: number;
      rate: number;
      hops: RouteHop[];
      highImpact: boolean;
    }
  | { ok: false; reason: string };

export function simulateQuote({
  amountIn,
  from,
  to,
  assets,
  market,
  slippageBps,
}: {
  amountIn: number;
  from: SwapAsset;
  to: SwapAsset;
  assets: SwapAsset[];
  market: SwapMarket;
  slippageBps: number;
}): SwapQuote {
  if (!(amountIn > 0) || !Number.isFinite(amountIn)) return { ok: false, reason: "Enter an amount" };
  if (from.key === to.key) return { ok: false, reason: "Pick two different tokens" };
  if (!from.address || !to.address) return { ok: false, reason: `$${(!from.address ? from : to).symbol} isn't linked yet` };
  const slipErr = validateSlippage(slippageBps);
  if (slipErr) return { ok: false, reason: slipErr };

  const path = routeFor(from, to, assets);
  const pIn = market[from.key]?.priceUsd ?? 0;
  const pOut = market[to.key]?.priceUsd ?? 0;
  if (!(pIn > 0)) return { ok: false, reason: `No live price for $${from.symbol} yet` };
  if (!(pOut > 0)) return { ok: false, reason: `No live price for $${to.symbol} yet` };

  const fee = POOL_FEE_BPS / 10_000;
  const startUsd = amountIn * pIn;
  let usd = startUsd;
  let feeUsd = 0;
  const hops: RouteHop[] = [];
  for (let i = 0; i < path.length - 1; i++) {
    const a = path[i]!;
    const b = path[i + 1]!;
    const jetton = a.key === "ton" ? b : a;
    const depth = market[jetton.key]?.liquidityUsd ?? 0;
    if (!(depth > 0)) return { ok: false, reason: `No ${a.symbol}/${b.symbol} pool with liquidity yet` };
    // Constant product with each side holding half the pool's USD depth.
    const reserve = depth / 2;
    const afterFee = usd * (1 - fee);
    feeUsd += usd - afterFee;
    usd = (reserve * afterFee) / (reserve + afterFee);
    hops.push({ from: a.symbol, to: b.symbol, dex: "CoffeeSwap", feeBps: POOL_FEE_BPS });
  }

  const noImpactUsd = startUsd * Math.pow(1 - fee, hops.length);
  const priceImpact = noImpactUsd > 0 ? Math.max(0, 1 - usd / noImpactUsd) : 0;
  const amountOut = usd / pOut;
  const minOut = amountOut * (1 - slippageBps / 10_000);
  return {
    ok: true,
    amountIn,
    amountOut,
    minOut,
    priceImpact,
    feeUsd,
    rate: amountOut / amountIn,
    hops,
    highImpact: priceImpact > HIGH_IMPACT,
  };
}

// ── Live API payloads ─────────────────────────────────────────────────
export type CoffeeTokenAddress = { blockchain: "ton"; address: string };
export type CoffeeRouteRequest = { input_token: CoffeeTokenAddress; output_token: CoffeeTokenAddress; input_amount: number };

/** Body for POST {COFFEE_API}/v1/route. */
export function buildRouteRequest(from: SwapAsset, to: SwapAsset, amountIn: number): CoffeeRouteRequest {
  if (!from.address || !to.address) throw new Error("Token not linked");
  if (!(amountIn > 0)) throw new Error("Amount must be positive");
  return {
    input_token: { blockchain: "ton", address: from.address },
    output_token: { blockchain: "ton", address: to.address },
    input_amount: amountIn,
  };
}

/** One transaction from POST {COFFEE_API}/v2/route/transactions. */
export type CoffeeTx = { address: string; value: string; cell?: string };
export type TonConnectSwapRequest = {
  validUntil: number;
  messages: { address: string; amount: string; payload?: string }[];
};

/** TonConnect wallets accept at most 4 messages per request. */
export const MAX_TONCONNECT_MESSAGES = 4;

/** Maps CoffeeSwap transactions to a TonConnect request; validUntil is unix seconds. */
export function toTonConnectRequest(txs: CoffeeTx[], now = Date.now(), validForMs = 5 * 60_000): TonConnectSwapRequest {
  if (txs.length === 0) throw new Error("No swap transactions to send");
  if (txs.length > MAX_TONCONNECT_MESSAGES) throw new Error(`Route needs ${txs.length} messages; wallets accept ${MAX_TONCONNECT_MESSAGES}`);
  for (const t of txs) {
    if (!t.address || !/^\d+$/.test(t.value)) throw new Error("Malformed swap transaction");
  }
  return {
    validUntil: Math.floor((now + validForMs) / 1000),
    messages: txs.map((t) => ({ address: t.address, amount: t.value, payload: t.cell })),
  };
}
