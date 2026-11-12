// TonMap-style territory radar: memecoin factions control sectors of a grid in
// proportion to their market strength. Pure and deterministic.
import { hashString } from "@/lib/assets/recipe";

export type TerritoryCoin = { master: string; symbol: string; volume24hUsd: number; liquidityUsd: number };
export type Sector = { index: number; master: string | null; symbol: string | null; hue: number };

export const TERRITORY_SIZE = 6;
export const TERRITORY_FACTIONS = 8;

export function coinStrength(c: Pick<TerritoryCoin, "volume24hUsd" | "liquidityUsd">): number {
  return Math.sqrt(Math.max(0, c.volume24hUsd)) + Math.sqrt(Math.max(0, c.liquidityUsd)) / 2;
}

/** Largest-remainder allocation of `slots` across weights. */
export function allocateSlots(weights: number[], slots: number): number[] {
  const total = weights.reduce((s, w) => s + w, 0);
  if (total <= 0) return weights.map(() => 0);
  const raw = weights.map((w) => (w / total) * slots);
  const out = raw.map(Math.floor);
  let left = slots - out.reduce((s, v) => s + v, 0);
  const order = raw.map((r, i) => ({ i, f: r - Math.floor(r) })).sort((a, b) => b.f - a.f || a.i - b.i);
  for (const { i } of order) {
    if (left <= 0) break;
    out[i]! += 1;
    left -= 1;
  }
  return out;
}

export function buildTerritory(coins: TerritoryCoin[], size = TERRITORY_SIZE): Sector[] {
  const cells = size * size;
  const top = [...coins]
    .filter((c) => coinStrength(c) > 0)
    .sort((a, b) => coinStrength(b) - coinStrength(a))
    .slice(0, TERRITORY_FACTIONS);
  const slots = allocateSlots(top.map(coinStrength), cells);
  const owners: (TerritoryCoin | null)[] = [];
  top.forEach((c, i) => {
    for (let k = 0; k < slots[i]!; k++) owners.push(c);
  });
  while (owners.length < cells) owners.push(null);
  // Deterministic placement: order cells by a hash so territories look scattered but stable.
  const cellOrder = Array.from({ length: cells }, (_, i) => i).sort(
    (a, b) => parseInt(hashString(`cell:${a}`), 16) - parseInt(hashString(`cell:${b}`), 16),
  );
  const sectors: Sector[] = Array.from({ length: cells }, (_, i) => ({ index: i, master: null, symbol: null, hue: 0 }));
  cellOrder.forEach((cell, k) => {
    const c = owners[k] ?? null;
    sectors[cell] = {
      index: cell,
      master: c?.master ?? null,
      symbol: c?.symbol ?? null,
      hue: c ? parseInt(hashString(c.master).slice(0, 4), 16) % 360 : 0,
    };
  });
  return sectors;
}

export function territoryLeader(sectors: Sector[]): { symbol: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const s of sectors) if (s.symbol) counts.set(s.symbol, (counts.get(s.symbol) ?? 0) + 1);
  let best: { symbol: string; count: number } | null = null;
  for (const [symbol, count] of counts) if (!best || count > best.count) best = { symbol, count };
  return best;
}
