// Apocalypse Protocol: Doomsday clock, radiation level, apex survivor standings,
// fallout warnings and bunker perks. Pure — safe on server, client and in tests.
import {
  APOCALYPSE_AT,
  CONVICTION_FULL_DAYS,
  TIER_RULES,
  apocalypseScore,
  countdownParts,
  type MarketCoin,
} from "@/lib/war-cycle/cycle";
import { LANDLORD_MULTIPLIER } from "@/lib/vault/vault";

/** Start of the bullrun campaign the Doomsday clock measures against. */
export const BULLRUN_START = Date.UTC(2025, 9, 31, 18, 0, 0);

/** Share of the radiation scale driven by elapsed time; the rest comes from the market. */
export const TIME_RADIATION_MAX = 60;
export const MARKET_RADIATION_MAX = 40;

export type RadiationBand = "calm" | "elevated" | "severe" | "critical";

export function doomsdayClock(now: number, end = APOCALYPSE_AT) {
  const msLeft = Math.max(0, end - now);
  return { msLeft, parts: countdownParts(msLeft), detonated: msLeft === 0 };
}

/** 0 at campaign start, 1 at Doomsday. */
export function doomsdayProgress(now: number, start = BULLRUN_START, end = APOCALYPSE_AT): number {
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}

/**
 * Market volatility 0..1 from median daily turnover (24h volume / liquidity).
 * A pool that trades half its depth per day reads ≈ 0.63.
 */
export function marketVolatility(coins: Pick<MarketCoin, "liquidityUsd" | "volume24hUsd">[]): number {
  const turnovers = coins
    .filter((c) => c.liquidityUsd > 0 && c.volume24hUsd >= 0)
    .map((c) => c.volume24hUsd / c.liquidityUsd)
    .sort((a, b) => a - b);
  if (turnovers.length === 0) return 0;
  const mid = Math.floor(turnovers.length / 2);
  const median = turnovers.length % 2 ? turnovers[mid]! : (turnovers[mid - 1]! + turnovers[mid]!) / 2;
  return 1 - Math.exp(-median / 0.5);
}

export function radiationBand(level: number): RadiationBand {
  if (level >= 75) return "critical";
  if (level >= 50) return "severe";
  if (level >= 25) return "elevated";
  return "calm";
}

/** Most radiation points faction trading can shield. */
export const SHIELD_MAX = 15;
/** Faction volume at which shielding reaches ~63% of its maximum. */
export const SHIELD_VOLUME_USD = 250_000;

/** Radiation points removed by the factions' combined 24h trading volume. */
export function volumeShielding(factionVolumeUsd: number): number {
  if (!(factionVolumeUsd > 0)) return 0;
  return SHIELD_MAX * (1 - Math.exp(-factionVolumeUsd / SHIELD_VOLUME_USD));
}

export function radiationLevel({
  now,
  coins,
  start = BULLRUN_START,
  end = APOCALYPSE_AT,
  factionVolumeUsd = 0,
}: {
  now: number;
  coins: Pick<MarketCoin, "liquidityUsd" | "volume24hUsd">[];
  start?: number;
  end?: number;
  /** Combined 24h volume of the faction coins; trading shields the clock. */
  factionVolumeUsd?: number;
}) {
  const progress = doomsdayProgress(now, start, end);
  const volatility = marketVolatility(coins);
  const timeRad = TIME_RADIATION_MAX * Math.pow(progress, 1.5);
  const marketRad = MARKET_RADIATION_MAX * volatility;
  const shield = volumeShielding(factionVolumeUsd);
  const level = progress >= 1 ? 100 : Math.round(Math.min(100, Math.max(0, timeRad + marketRad - shield)));
  return { level, band: radiationBand(level), progress, volatility, timeRad: Math.round(timeRad), marketRad: Math.round(marketRad), shield: Math.round(shield) };
}

export type ApexEntry = {
  master: string;
  symbol: string;
  image: string | null;
  liquidityUsd: number;
  volume24hUsd: number;
  convictionHolders: number;
  score: number;
  /** Share of the top-N combined score, 0..1. */
  share: number;
};

/** Ranks survivors with the published Apocalypse formula; ties go to the lower master address. */
export function apexStandings(
  coins: Pick<MarketCoin, "master" | "symbol" | "image" | "liquidityUsd" | "volume24hUsd">[],
  holders: ReadonlyMap<string, number> = new Map(),
  limit = 5,
): ApexEntry[] {
  const seen = new Set<string>();
  const ranked = coins
    .filter((c) => (seen.has(c.master) ? false : (seen.add(c.master), true)))
    .map((c) => {
      const convictionHolders = holders.get(c.master) ?? 0;
      const score = apocalypseScore({ master: c.master, convictionHolders, liquidityUsd: c.liquidityUsd, volume24hUsd: c.volume24hUsd });
      return { master: c.master, symbol: c.symbol, image: c.image, liquidityUsd: c.liquidityUsd, volume24hUsd: c.volume24hUsd, convictionHolders, score, share: 0 };
    })
    .sort((a, b) => b.score - a.score || (a.master < b.master ? -1 : a.master > b.master ? 1 : 0))
    .slice(0, Math.max(0, limit));
  const total = ranked.reduce((s, x) => s + x.score, 0);
  for (const r of ranked) r.share = total > 0 ? r.score / total : 0;
  return ranked;
}

/** How far #1 leads #2, as a fraction of #1's score (1 when unopposed). */
export function apexLeadMargin(standings: Pick<ApexEntry, "score">[]): number {
  const [a, b] = standings;
  if (!a || a.score <= 0) return 0;
  if (!b) return 1;
  return Math.max(0, (a.score - b.score) / a.score);
}

export type FalloutWarning = { id: string; severity: "info" | "warn" | "danger"; text: string };

/** Coins under this liquidity sit in the blast zone (below the Captain tier). */
export const BLAST_ZONE_LIQUIDITY_USD = TIER_RULES.captain.minLiquidityUsd;
export const CLOSE_RACE_MARGIN = 0.05;

export function falloutWarnings({
  level,
  msLeft,
  standings,
  coins,
}: {
  level: number;
  msLeft: number;
  standings: Pick<ApexEntry, "symbol" | "score">[];
  coins: Pick<MarketCoin, "liquidityUsd">[];
}): FalloutWarning[] {
  const out: FalloutWarning[] = [];
  const band = radiationBand(level);
  const exposed = coins.filter((c) => c.liquidityUsd < BLAST_ZONE_LIQUIDITY_USD).length;
  if (msLeft === 0) {
    out.push({ id: "detonated", severity: "danger", text: "Doomsday has struck. Only the apex coin survives." });
    return out;
  }
  if (band === "severe" || band === "critical") {
    out.push({
      id: "blast-zone",
      severity: band === "critical" ? "danger" : "warn",
      text: `Radiation ${level}%: ${exposed} coin${exposed === 1 ? "" : "s"} under $${BLAST_ZONE_LIQUIDITY_USD / 1000}K liquidity sit in the blast zone.`,
    });
  } else if (exposed > 0) {
    out.push({ id: "blast-zone", severity: "info", text: `${exposed} small coin${exposed === 1 ? "" : "s"} would not survive a blast today. Liquidity is armour.` });
  }
  if (standings.length >= 2 && apexLeadMargin(standings) < CLOSE_RACE_MARGIN) {
    out.push({ id: "close-race", severity: "warn", text: `Apex race too close to call: $${standings[0]!.symbol} and $${standings[1]!.symbol} are within 5%.` });
  }
  const days = msLeft / 86_400_000;
  if (days <= 30) out.push({ id: "final-month", severity: "danger", text: "Final month. Conviction locked in now is the last to reach full weight." });
  else if (days <= 90) out.push({ id: "final-quarter", severity: "warn", text: "Under 90 days to Doomsday. Bunker down in the coin you believe will survive." });
  return out;
}

export type BunkerPerk = { id: string; title: string; text: string };

/** Survival perks — each one restates a rule the game already applies. */
export const BUNKER_PERKS: BunkerPerk[] = [
  {
    id: "conviction",
    title: "Deep bunker",
    text: `Conviction holdings reach full payout weight after ${CONVICTION_FULL_DAYS} days of holding.`,
  },
  {
    id: "survivor-vote",
    title: "Survivor vote",
    text: "Every conviction holder adds 2 points to a coin's survival score — more than liquidity or volume can.",
  },
  {
    id: "shielding",
    title: "Trade shielding",
    text: `Faction trading volume (UTYA, WARDOG, WARCAT, GRAM) blocks up to ${SHIELD_MAX} radiation points on the Doomsday clock.`,
  },
  {
    id: "landlord",
    title: "Landlord shelter",
    text: `TonMap Landlords get ×${LANDLORD_MULTIPLIER} on weekly War Vault payouts.`,
  },
];
