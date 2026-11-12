// War Vault reward rules. Pure and browser-safe: the server uses them to
// distribute each weekly cycle pool, the UI uses them to explain payouts.

export type VaultAssetKind = "native" | "jetton";
export type VaultAsset = {
  /** "ton" for native TON, otherwise the jetton master address (friendly). */
  key: string;
  symbol: string;
  kind: VaultAssetKind;
  decimals: number;
  /** Smallest amount a player can withdraw, in whole units. */
  minClaim: number;
};

export const TON_ASSET: VaultAsset = { key: "ton", symbol: "GRAM", kind: "native", decimals: 9, minClaim: 0.05 };

/** Share of each cycle pool by bucket. Must sum to 1. */
export const POOL_SPLIT = {
  leaderboard: 0.5,
  faction: 0.3,
  conviction: 0.2,
} as const;

/** Only the top N commanders by glory share the leaderboard bucket. */
export const LEADERBOARD_PAID_RANKS = 100;
/** Multiplier for verified TonMap landlords (pixel holders). */
export const LANDLORD_MULTIPLIER = 1.15;
/** Signed claim vouchers are valid for this long. */
export const VOUCHER_TTL_SEC = 24 * 60 * 60;
/** Share of every pack purchase that flows into the current cycle pool. */
export const PACK_FEE_TO_POOL = 0.02;

export type Allocation = Map<number, number>;

function addTo(map: Allocation, id: number, v: number) {
  if (v <= 0) return;
  map.set(id, (map.get(id) ?? 0) + v);
}

export function splitPool(pool: number) {
  const p = Math.max(0, pool);
  return {
    leaderboard: p * POOL_SPLIT.leaderboard,
    faction: p * POOL_SPLIT.faction,
    conviction: p * POOL_SPLIT.conviction,
  };
}

/**
 * Linear rank weights: rank 1 gets weight N, rank N gets weight 1.
 * `entries` must already be sorted best first.
 */
export function leaderboardShares(amount: number, entries: { userId: number }[]): Allocation {
  const out: Allocation = new Map();
  const paid = entries.slice(0, LEADERBOARD_PAID_RANKS);
  const n = paid.length;
  if (n === 0 || amount <= 0) return out;
  const total = (n * (n + 1)) / 2;
  paid.forEach((e, i) => addTo(out, e.userId, (amount * (n - i)) / total));
  return out;
}

/** Winning faction members split by their glory contribution. */
export function factionShares(amount: number, members: { userId: number; glory: number }[]): Allocation {
  const out: Allocation = new Map();
  const total = members.reduce((s, m) => s + Math.max(0, m.glory), 0);
  if (total <= 0 || amount <= 0) return out;
  for (const m of members) addTo(out, m.userId, (amount * Math.max(0, m.glory)) / total);
  return out;
}

export function pickWinningFaction(totals: { wardog: number; warcat: number }): "wardog" | "warcat" | null {
  if (totals.wardog === totals.warcat) return null;
  return totals.wardog > totals.warcat ? "wardog" : "warcat";
}

/**
 * Applies per-user multipliers, then rescales so the total never exceeds
 * the original allocation (the vault can never pay more than it holds).
 */
export function applyMultipliers(alloc: Allocation, multipliers: Map<number, number>): Allocation {
  const before = [...alloc.values()].reduce((s, v) => s + v, 0);
  const boosted: Allocation = new Map();
  for (const [id, v] of alloc) boosted.set(id, v * (multipliers.get(id) ?? 1));
  const after = [...boosted.values()].reduce((s, v) => s + v, 0);
  if (after <= 0) return boosted;
  const k = before / after;
  for (const [id, v] of boosted) boosted.set(id, v * k);
  return boosted;
}

export function mergeAllocations(...parts: Allocation[]): Allocation {
  const out: Allocation = new Map();
  for (const p of parts) for (const [id, v] of p) addTo(out, id, v);
  return out;
}

/** Rounds every allocation down to the asset's precision. */
export function floorTo(alloc: Allocation, decimals: number): Allocation {
  const f = 10 ** Math.min(9, decimals);
  const out: Allocation = new Map();
  for (const [id, v] of alloc) {
    const r = Math.floor(v * f) / f;
    if (r > 0) out.set(id, r);
  }
  return out;
}

export type CycleInputs = {
  pool: number;
  decimals: number;
  leaderboard: { userId: number }[];
  winningMembers: { userId: number; glory: number }[];
  conviction: Allocation;
  landlords: Set<number>;
};

/**
 * Full cycle distribution. Unclaimable buckets (no winner, no conviction)
 * roll into the leaderboard bucket so the pool is always fully paid out.
 */
export function distributeCycle(c: CycleInputs): Allocation {
  const s = splitPool(c.pool);
  let lbAmount = s.leaderboard;
  const faction = factionShares(s.faction, c.winningMembers);
  if (faction.size === 0) lbAmount += s.faction;
  const convTotal = [...c.conviction.values()].reduce((a, v) => a + v, 0);
  const conviction: Allocation = new Map();
  if (convTotal > 0) {
    for (const [id, v] of c.conviction) conviction.set(id, (s.conviction * v) / convTotal);
  } else {
    lbAmount += s.conviction;
  }
  const lb = leaderboardShares(lbAmount, c.leaderboard);
  const merged = mergeAllocations(lb, faction, conviction);
  const mult = new Map<number, number>();
  for (const id of c.landlords) mult.set(id, LANDLORD_MULTIPLIER);
  return floorTo(applyMultipliers(merged, mult), c.decimals);
}

export function claimableBalance(accrued: number, lockedInVouchers: number): number {
  return Math.max(0, accrued - lockedInVouchers);
}

export function canClaim(amount: number, asset: Pick<VaultAsset, "minClaim">): { ok: true } | { ok: false; reason: string } {
  if (!(amount > 0)) return { ok: false, reason: "Nothing to claim yet" };
  if (amount < asset.minClaim) return { ok: false, reason: `Minimum claim is ${asset.minClaim}` };
  return { ok: true };
}

/** Cycle key = UTC date of the Sunday battle that closes the cycle, e.g. "2026-11-15". */
export function cycleKey(battleAtMs: number): string {
  return new Date(battleAtMs).toISOString().slice(0, 10);
}
