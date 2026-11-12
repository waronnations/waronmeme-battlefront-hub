// Multi-route swap selector: venues, jetton safety, memepad graduation, and quote normalisation.
// Pure — quotes and ready-to-sign transactions come from swap.coffee's routing API (server side);
// the player signs them in-game through TonConnect.
import { toTonConnectRequest, type CoffeeTx, type TonConnectSwapRequest } from "./coffeeswap";

// ── Venues ────────────────────────────────────────────────────────────
export type VenueId = "best" | "stonfi" | "dedust" | "tonco" | "x1000";
export type VenueKind = "aggregator" | "dex" | "memepad";
export type Venue = {
  id: VenueId;
  kind: VenueKind;
  label: string;
  /** Short venue name shown on the trade button. */
  app: string;
  tagline: string;
  /** swap.coffee pool_selector.dexes; undefined = every DEX (best rate). */
  dexes?: string[];
};

export const VENUES: Venue[] = [
  { id: "best", kind: "aggregator", label: "Best rate", app: "swap.coffee", tagline: "swap.coffee splits across every DEX" },
  { id: "stonfi", kind: "dex", label: "STON.fi", app: "STON.fi", tagline: "Direct STON.fi pools", dexes: ["stonfi", "stonfi_v2"] },
  { id: "dedust", kind: "dex", label: "DeDust", app: "DeDust", tagline: "Direct DeDust pools", dexes: ["dedust", "dedust_v2"] },
  { id: "tonco", kind: "dex", label: "TONCO", app: "TONCO", tagline: "Concentrated liquidity pools", dexes: ["tonco", "tonco_v2"] },
  { id: "x1000", kind: "memepad", label: "x1000 curve", app: "x1000", tagline: "Uranus memepad bonding curve" },
];

/** Direct DEX routes may use one intermediate token, but only inside that DEX. */
export const DIRECT_MAX_LENGTH = 3;

const DEX_LABELS: Record<string, string> = {
  stonfi: "STON.fi",
  stonfi_v2: "STON.fi",
  dedust: "DeDust",
  dedust_v2: "DeDust",
  tonco: "TONCO",
  tonco_v2: "TONCO",
  coffee: "Coffee DEX",
  bidask: "BidAsk",
  moon: "Moon",
  colossus: "Colossus",
  tonraffles: "TonRaffles",
  tonstakers: "Tonstakers",
  torch_finance: "Torch",
};
export const dexLabel = (dex: string) => DEX_LABELS[dex] ?? dex;

// ── Jetton safety ─────────────────────────────────────────────────────
export type Verification = "WHITELISTED" | "COMMUNITY" | "UNKNOWN" | "BLACKLISTED";
export function normalizeVerification(v: string | null | undefined): Verification {
  const u = (v ?? "").toUpperCase();
  return u === "WHITELISTED" || u === "COMMUNITY" || u === "BLACKLISTED" ? u : "UNKNOWN";
}

export type Safety = { level: Verification; label: string; tone: "green" | "cyan" | "amber" | "red"; routable: boolean; note: string };
export function safetyOf(v: string | null | undefined): Safety {
  const level = normalizeVerification(v);
  switch (level) {
    case "WHITELISTED":
      return { level, label: "Verified", tone: "green", routable: true, note: "Whitelisted by swap.coffee" };
    case "COMMUNITY":
      return { level, label: "Safe contract", tone: "cyan", routable: true, note: "Contract code recognised as a safe, fee-free jetton" };
    case "BLACKLISTED":
      return { level, label: "Blocked", tone: "red", routable: false, note: "Flagged as dangerous — trading disabled" };
    default:
      return { level, label: "Unverified", tone: "amber", routable: false, note: "Unknown contract — trading disabled until verified" };
  }
}

// ── Memepad graduation ────────────────────────────────────────────────
const PADS: Record<string, string> = { URANUS: "x1000 Uranus", BLUM: "Blum", STONKS_V2: "Stonks", STONKS: "Stonks", TONFUN: "TON.fun" };
export const padLabel = (protocol: string) => PADS[protocol.toUpperCase()] ?? protocol;

/** Graduated jettons keep their launchpad's wallet code, which tells us where they were born. */
export function padFromInterface(contractInterface: string | null | undefined): string | null {
  const i = (contractInterface ?? "").toLowerCase();
  if (i.includes("uranus")) return "URANUS";
  if (i.includes("blum")) return "BLUM";
  if (i.includes("stonks")) return "STONKS_V2";
  if (i.includes("tonfun")) return "TONFUN";
  return null;
}

export type Graduation =
  | { status: "curve"; protocol: string; pad: string; progress: number; collected: number; target: number }
  | { status: "graduated"; protocol: string; pad: string }
  | { status: "dex" };

/** Raw swap.coffee jetton (`type: common`) or memepad jetton (`type: memepad`). */
export type CoffeeJetton = {
  type?: string;
  protocol?: string;
  verification?: string | null;
  contract_interface?: string | null;
  market_stats?: { price_usd?: number; collected_ton?: number; max_ton?: number; progress?: number; tvl_usd?: number };
};

export function graduationOf(j: CoffeeJetton | null): Graduation {
  if (!j) return { status: "dex" };
  if (j.type === "memepad" && j.protocol) {
    const s = j.market_stats ?? {};
    const progress = Math.min(1, Math.max(0, Number(s.progress ?? 0)));
    return { status: "curve", protocol: j.protocol, pad: padLabel(j.protocol), progress, collected: Number(s.collected_ton ?? 0), target: Number(s.max_ton ?? 0) };
  }
  const born = padFromInterface(j.contract_interface);
  return born ? { status: "graduated", protocol: born, pad: padLabel(born) } : { status: "dex" };
}

/** Uranus standard launch fee (1%); x1000 also offers 0.25% and 3% launches. */
export const CURVE_FEE_BPS = 100;

// ── Quotes ────────────────────────────────────────────────────────────
export type QuoteHop = { dex: string; from: string; to: string };
export type RouteQuote =
  | {
      venue: VenueId;
      ok: true;
      amountOut: number;
      priceImpact: number;
      gasGram: number;
      hops: QuoteHop[];
      dexes: string[];
      splits: number;
      /** Bonding-curve spot estimate rather than a routed quote. */
      estimate: boolean;
    }
  | { venue: VenueId; ok: false; reason: string; graduated?: boolean };

type CoffeeToken = { metadata?: { symbol?: string; verification?: string } };
export type CoffeePath = { dex: string; input_token: CoffeeToken; output_token: CoffeeToken; next?: CoffeePath[] | null };
export type CoffeeRoute = {
  output_amount?: number;
  price_impact?: number | string;
  recommended_gas?: number;
  left_amount?: number;
  paths?: CoffeePath[];
};

function walk(p: CoffeePath, visit: (p: CoffeePath) => void) {
  visit(p);
  for (const n of p.next ?? []) walk(n, visit);
}

/** Turns a swap.coffee /v1/route response into a quote, refusing routes through unsafe tokens. */
export function summarizeCoffeeRoute(venue: VenueId, r: CoffeeRoute | null, allowedDexes?: string[]): RouteQuote {
  const paths = r?.paths ?? [];
  const out = Number(r?.output_amount ?? 0);
  if (!r || paths.length === 0 || !(out > 0)) return { venue, ok: false, reason: "No pool with liquidity on this route" };
  if (Number(r.left_amount ?? 0) > 0) return { venue, ok: false, reason: "Not enough liquidity for the full amount" };

  const dexes = new Set<string>();
  let unsafe: string | null = null;
  let foreign = false;
  for (const p of paths)
    walk(p, (h) => {
      dexes.add(dexLabel(h.dex));
      if (allowedDexes && !allowedDexes.includes(h.dex)) foreign = true;
      for (const t of [h.input_token, h.output_token]) {
        if (!unsafe && !safetyOf(t.metadata?.verification).routable) unsafe = t.metadata?.symbol ?? "unknown token";
      }
    });
  if (unsafe) return { venue, ok: false, reason: `Route passes through unverified $${unsafe}` };
  // swap.coffee may borrow another DEX for a leg; a "direct" venue must stay on its own pools.
  if (foreign) return { venue, ok: false, reason: `No route on ${dexLabel(allowedDexes![0]!)} pools alone` };

  const hops: QuoteHop[] = [];
  walk(paths[0]!, (h) => hops.push({ dex: dexLabel(h.dex), from: h.input_token.metadata?.symbol ?? "?", to: h.output_token.metadata?.symbol ?? "?" }));
  const impact = Math.abs(Number(r.price_impact));
  return {
    venue,
    ok: true,
    amountOut: out,
    priceImpact: Number.isFinite(impact) ? impact : 0,
    gasGram: Number(r.recommended_gas ?? 0),
    hops,
    dexes: [...dexes],
    splits: paths.length,
    estimate: false,
  };
}

/** Memepad route: spot price on the curve minus the launch fee, only while the curve is live. */
export function curveQuote({
  amountIn,
  gramUsd,
  tokenUsd,
  graduation,
  toSymbol,
}: {
  amountIn: number;
  gramUsd: number;
  tokenUsd: number;
  graduation: Graduation;
  toSymbol: string;
}): RouteQuote {
  const venue: VenueId = "x1000";
  if (graduation.status === "graduated")
    return { venue, ok: false, graduated: true, reason: `Graduated from ${graduation.pad} — now trades on DEX pools` };
  if (graduation.status === "dex") return { venue, ok: false, reason: `$${toSymbol} never launched on a memepad` };
  if (graduation.protocol !== "URANUS") return { venue, ok: false, reason: `Curve lives on ${graduation.pad}, not x1000` };
  if (!(amountIn > 0) || !(gramUsd > 0) || !(tokenUsd > 0)) return { venue, ok: false, reason: "No live curve price yet" };
  const afterFee = amountIn * (1 - CURVE_FEE_BPS / 10_000);
  return {
    venue,
    ok: true,
    amountOut: (afterFee * gramUsd) / tokenUsd,
    priceImpact: 0,
    gasGram: 0.1,
    hops: [{ dex: graduation.pad, from: "GRAM", to: toSymbol }],
    dexes: [graduation.pad],
    splits: 1,
    estimate: true,
  };
}

export const minReceived = (amountOut: number, slippageBps: number) => amountOut * (1 - slippageBps / 10_000);

/** Highest output among routed quotes; curve estimates only win when nothing is routable. */
export function pickBest(quotes: RouteQuote[]): VenueId | null {
  const ok = quotes.filter((q): q is Extract<RouteQuote, { ok: true }> => q.ok);
  const routed = ok.filter((q) => !q.estimate);
  const pool = routed.length ? routed : ok;
  if (!pool.length) return null;
  return pool.reduce((a, b) => (b.amountOut > a.amountOut ? b : a)).venue;
}

// ── In-game execution ─────────────────────────────────────────────────
/** Memepad curves are quoted for comparison only; their buy contracts aren't routed in-game. */
export const tradesInGame = (id: VenueId) => venueById(id).kind !== "memepad";

const NANO = 1_000_000_000n;
const toNano = (n: number) => BigInt(Math.round(n * 1e9));
/** Extra GRAM a swap may attach for gas on top of the amount (unused gas is refunded by the DEX). */
export const MAX_GAS_GRAM = 3;

/**
 * Turns swap.coffee's built transactions into a TonConnect request, refusing anything that would
 * spend more than the player's amount plus the route's recommended gas (+0.5 GRAM, capped).
 */
export function checkSwapTxs(txs: CoffeeTx[], amountIn: number, recommendedGas: number, now = Date.now()): TonConnectSwapRequest {
  const req = toTonConnectRequest(txs, now);
  const total = req.messages.reduce((s, m) => s + BigInt(m.amount), 0n);
  const gas = Math.min(MAX_GAS_GRAM, Math.max(0, recommendedGas) + 0.5);
  const cap = toNano(amountIn) + toNano(gas);
  if (total > cap) throw new Error(`Swap asks for ${Number((total * 1000n) / NANO) / 1000} GRAM — more than your amount plus gas`);
  if (total < toNano(amountIn)) throw new Error("Swap transaction doesn't carry your full amount");
  return req;
}

export type SwapOutcome = "pending" | "success" | "partial" | "failed";
type CoffeeResult = { terminal?: boolean; splits?: { status?: string }[] };
/** Reads GET /v2/route/result: done once terminal; partial when only some splits landed. */
export function swapOutcome(r: CoffeeResult | null): SwapOutcome {
  if (!r?.terminal) return "pending";
  const splits = r.splits ?? [];
  const ok = splits.filter((s) => s.status === "succeeded").length;
  if (splits.length > 0 && ok === splits.length) return "success";
  return ok > 0 ? "partial" : "failed";
}

export const venueById = (id: VenueId) => VENUES.find((v) => v.id === id)!;
