// War Room sectors: the four faction memecoins mapped onto the globe.
// Pure — shared by the War Room page, the agent tools and tests.
import type { MarketCoin } from "@/lib/war-cycle/cycle";
import { WARCAT_CA, WARDOG_CA } from "@/lib/tokens";

export type FactionId = "utya" | "wardog" | "warcat" | "gram";

export const FACTIONS: { id: FactionId; symbol: string; master?: string; lat: number; lon: number }[] = [
  { id: "utya", symbol: "UTYA", lat: 38, lon: -40 },
  { id: "wardog", symbol: "WARDOG", master: WARDOG_CA, lat: 12, lon: 70 },
  { id: "warcat", symbol: "WARCAT", master: WARCAT_CA, lat: -24, lon: 165 },
  { id: "gram", symbol: "GRAM", lat: -8, lon: -120 },
];

export type Sector = {
  id: FactionId;
  symbol: string;
  master: string | null;
  priceUsd: number;
  liquidityUsd: number;
  volume24hUsd: number;
  /** Share of the four factions' combined 24h volume, 0..1. */
  dominance: number;
  lat: number;
  lon: number;
};

const norm = (s: string) => s.replace(/^\$/, "").toUpperCase();

/** Finds each faction coin by master address first, then by exact symbol (deepest pool wins). */
export function factionSectors(coins: Pick<MarketCoin, "master" | "symbol" | "priceUsd" | "liquidityUsd" | "volume24hUsd">[]): Sector[] {
  const rows = FACTIONS.map((f) => {
    const byMaster = f.master ? coins.find((c) => c.master === f.master) : undefined;
    const bySymbol = coins.filter((c) => norm(c.symbol) === f.symbol).sort((a, b) => b.liquidityUsd - a.liquidityUsd)[0];
    const c = byMaster ?? bySymbol;
    return {
      id: f.id,
      symbol: f.symbol,
      master: c?.master ?? f.master ?? null,
      priceUsd: c?.priceUsd ?? 0,
      liquidityUsd: c?.liquidityUsd ?? 0,
      volume24hUsd: c?.volume24hUsd ?? 0,
      dominance: 0,
      lat: f.lat,
      lon: f.lon,
    };
  });
  const total = rows.reduce((s, r) => s + r.volume24hUsd, 0);
  for (const r of rows) r.dominance = total > 0 ? r.volume24hUsd / total : 0;
  return rows;
}

export function totalVolume(sectors: Pick<Sector, "volume24hUsd">[]): number {
  return sectors.reduce((s, r) => s + r.volume24hUsd, 0);
}

/** Lat/lon in degrees → point on a sphere of `r`. */
export function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi = ((90 - lat) * Math.PI) / 180;
  const theta = ((lon + 180) * Math.PI) / 180;
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}
