// Wealth-based ranks and nation leadership. Pure.

export const WEALTH_RANKS = [
  { name: "Grunt", minUsd: 0 },
  { name: "Sergeant", minUsd: 50 },
  { name: "Lieutenant", minUsd: 250 },
  { name: "Captain", minUsd: 1_000 },
  { name: "Colonel", minUsd: 5_000 },
  { name: "General", minUsd: 25_000 },
  { name: "Marshal", minUsd: 100_000 },
  { name: "Warlord", minUsd: 500_000 },
] as const;

/** Leaders must have held at least this long, measured on the 24h average. */
export const LEADER_MIN_HOLD_HOURS = 24;

export function rankForWealth(usd: number) {
  let idx = 0;
  WEALTH_RANKS.forEach((r, i) => {
    if (usd >= r.minUsd) idx = i;
  });
  const current = WEALTH_RANKS[idx]!;
  const next = WEALTH_RANKS[idx + 1] ?? null;
  const progress = next ? (usd - current.minUsd) / (next.minUsd - current.minUsd) : 1;
  return {
    rank: current.name,
    index: idx,
    next: next?.name ?? null,
    toNextUsd: next ? Math.max(0, next.minUsd - usd) : 0,
    progress: Math.max(0, Math.min(1, progress)),
  };
}

export type WealthEntry = {
  userId: number;
  nationId: number | null;
  avgUsd24h: number;
  hoursTracked: number;
  flagged: boolean;
};

/** Richest eligible player per nation leads it. Ties go to the lower userId (earlier player). */
export function assignNationLeaders(entries: WealthEntry[]): Map<number, number> {
  const leaders = new Map<number, WealthEntry>();
  for (const e of entries) {
    if (e.nationId == null || e.flagged || e.hoursTracked < LEADER_MIN_HOLD_HOURS) continue;
    const cur = leaders.get(e.nationId);
    if (!cur || e.avgUsd24h > cur.avgUsd24h || (e.avgUsd24h === cur.avgUsd24h && e.userId < cur.userId)) {
      leaders.set(e.nationId, e);
    }
  }
  return new Map([...leaders].map(([n, e]) => [n, e.userId]));
}
