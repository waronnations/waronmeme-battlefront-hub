// Three-tier memecoin board, weekly battles, Apocalypse, strategies and conviction rewards. Pure.

export type CoinTier = "recruit" | "captain" | "admiral";

export const TIER_RULES: Record<CoinTier, { label: string; minLiquidityUsd: number }> = {
  recruit: { label: "Recruit", minLiquidityUsd: 5_000 },
  captain: { label: "Captain", minLiquidityUsd: 100_000 },
  admiral: { label: "Admiral", minLiquidityUsd: 1_000_000 },
};

/** Health gate: coins below these never appear on the board or in packs. */
export const HEALTH_RULES = { minLiquidityUsd: 5_000, minVolume24hUsd: 1_000 };

export type MarketCoin = {
  master: string;
  symbol: string;
  name: string;
  image: string | null;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  blacklisted: boolean;
  taxable: boolean;
};

export function isHealthy(c: MarketCoin): boolean {
  return (
    !c.blacklisted &&
    !c.taxable &&
    c.priceUsd > 0 &&
    c.liquidityUsd >= HEALTH_RULES.minLiquidityUsd &&
    c.volume24hUsd >= HEALTH_RULES.minVolume24hUsd
  );
}

export function classifyTier(liquidityUsd: number): CoinTier | null {
  if (liquidityUsd >= TIER_RULES.admiral.minLiquidityUsd) return "admiral";
  if (liquidityUsd >= TIER_RULES.captain.minLiquidityUsd) return "captain";
  if (liquidityUsd >= TIER_RULES.recruit.minLiquidityUsd) return "recruit";
  return null;
}

/** Weekly battles resolve Sundays 18:00 UTC. */
export function nextWeeklyBattle(now: number): number {
  const d = new Date(now);
  const target = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 18, 0, 0);
  const daysAhead = (7 - d.getUTCDay()) % 7;
  let t = target + daysAhead * 86_400_000;
  if (t <= now) t += 7 * 86_400_000;
  return t;
}

/** Estimated end of the bullrun; admins can override via feature flag config later. */
export const APOCALYPSE_AT = Date.UTC(2027, 9, 31, 18, 0, 0);

export function countdownParts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export type ApocalypseCandidate = {
  master: string;
  convictionHolders: number;
  liquidityUsd: number;
  volume24hUsd: number;
};

/** Published, verifiable winner formula. AI agents may recommend but cannot override it. */
export function apocalypseScore(c: ApocalypseCandidate): number {
  return c.convictionHolders * 2 + Math.log10(1 + c.liquidityUsd) * 10 + Math.log10(1 + c.volume24hUsd) * 5;
}

export function pickApocalypseWinner(cands: ApocalypseCandidate[]): string | null {
  let best: ApocalypseCandidate | null = null;
  for (const c of cands) {
    if (!best || apocalypseScore(c) > apocalypseScore(best) || (apocalypseScore(c) === apocalypseScore(best) && c.master < best.master)) best = c;
  }
  return best?.master ?? null;
}

export const CONVICTION_FULL_DAYS = 30;

export type ConvictionHolder = { userId: number; amount: number; heldSinceMs: number };

/** Square root of holdings times hold-time factor, so whales can't take everything. */
export function convictionPayouts(pool: number, holders: ConvictionHolder[], atMs: number): Map<number, number> {
  const weights = holders.map((h) => {
    const days = Math.max(0, (atMs - h.heldSinceMs) / 86_400_000);
    return { userId: h.userId, w: Math.sqrt(Math.max(0, h.amount)) * Math.min(1, days / CONVICTION_FULL_DAYS) };
  });
  const total = weights.reduce((s, x) => s + x.w, 0);
  const out = new Map<number, number>();
  for (const x of weights) out.set(x.userId, total > 0 ? (pool * x.w) / total : 0);
  return out;
}

export type StrategyHorizon = "short" | "medium" | "bullrun";
export type WarStrategy = {
  name: string;
  horizon: StrategyHorizon;
  tiers: CoinTier[];
  maxPositionPct: number;
  holdUntilApocalypse: boolean;
  autoNuke: boolean;
};

export const PRESET_STRATEGIES: WarStrategy[] = [
  { name: "Blitz", horizon: "short", tiers: ["recruit"], maxPositionPct: 10, holdUntilApocalypse: false, autoNuke: false },
  { name: "Campaign", horizon: "medium", tiers: ["captain", "admiral"], maxPositionPct: 20, holdUntilApocalypse: false, autoNuke: false },
  { name: "Total War", horizon: "bullrun", tiers: ["admiral"], maxPositionPct: 40, holdUntilApocalypse: true, autoNuke: true },
];

export function validateStrategy(s: WarStrategy): string | null {
  if (!s.name.trim() || s.name.length > 40) return "Name must be 1 to 40 characters";
  if (s.tiers.length === 0) return "Pick at least one tier";
  if (s.maxPositionPct < 1 || s.maxPositionPct > 100) return "Position size must be 1 to 100%";
  return null;
}
