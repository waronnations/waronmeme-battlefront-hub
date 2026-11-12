import { describe, expect, it } from "vitest";
import { APOCALYPSE_AT, pickApocalypseWinner } from "@/lib/war-cycle/cycle";
import {
  BULLRUN_START,
  apexLeadMargin,
  apexStandings,
  doomsdayClock,
  falloutWarnings,
  marketVolatility,
  radiationBand,
  radiationLevel,
} from "@/lib/apocalypse/engine";

const coin = (master: string, liquidityUsd: number, volume24hUsd: number) => ({ master, symbol: master.toUpperCase(), image: null, liquidityUsd, volume24hUsd });

describe("Apocalypse engine", () => {
  it("Doomsday clock counts down to the Apocalypse date and stops at zero", () => {
    const c = doomsdayClock(APOCALYPSE_AT - 90_061_000);
    expect(c.parts).toEqual({ d: 1, h: 1, m: 1, s: 1 });
    expect(doomsdayClock(APOCALYPSE_AT + 5).detonated).toBe(true);
    expect(doomsdayClock(APOCALYPSE_AT + 5).msLeft).toBe(0);
  });

  it("radiation is 0 at campaign start on a dead market and 100 at Doomsday", () => {
    expect(radiationLevel({ now: BULLRUN_START, coins: [] }).level).toBe(0);
    expect(radiationLevel({ now: APOCALYPSE_AT, coins: [] }).level).toBe(100);
  });

  it("time alone contributes at most 60 points; volatility adds up to 40", () => {
    const justBefore = APOCALYPSE_AT - 1;
    expect(radiationLevel({ now: justBefore, coins: [] }).level).toBe(60);
    const hot = [coin("a", 1_000, 1_000_000)];
    expect(radiationLevel({ now: BULLRUN_START, coins: hot }).level).toBe(40);
  });

  it("radiation rises over time for the same market", () => {
    const coins = [coin("a", 100_000, 50_000)];
    const mid = (BULLRUN_START + APOCALYPSE_AT) / 2;
    expect(radiationLevel({ now: mid, coins }).level).toBeGreaterThan(radiationLevel({ now: BULLRUN_START, coins }).level);
  });

  it("volatility uses median turnover: half the pool traded per day ≈ 0.63", () => {
    expect(marketVolatility([coin("a", 100, 50)])).toBeCloseTo(1 - Math.exp(-1), 5);
    expect(marketVolatility([])).toBe(0);
  });

  it("bands switch at 25, 50 and 75", () => {
    expect([24, 25, 49, 50, 74, 75].map(radiationBand)).toEqual(["calm", "elevated", "elevated", "severe", "severe", "critical"]);
  });

  it("apex #1 matches the published Apocalypse winner formula", () => {
    const coins = [coin("eqb", 2_000_000, 100_000), coin("eqa", 500_000, 900_000), coin("eqc", 50_000, 10_000)];
    const holders = new Map([["eqa", 40]]);
    const s = apexStandings(coins, holders, 3);
    const winner = pickApocalypseWinner(coins.map((c) => ({ master: c.master, convictionHolders: holders.get(c.master) ?? 0, liquidityUsd: c.liquidityUsd, volume24hUsd: c.volume24hUsd })));
    expect(s[0]!.master).toBe(winner);
    expect(s.reduce((t, x) => t + x.share, 0)).toBeCloseTo(1, 6);
  });

  it("flags a close race when #2 is within 5% of #1", () => {
    const s = [{ symbol: "A", score: 100 }, { symbol: "B", score: 96 }];
    expect(apexLeadMargin(s)).toBeCloseTo(0.04);
    const w = falloutWarnings({ level: 10, msLeft: 365 * 86_400_000, standings: s, coins: [] });
    expect(w.map((x) => x.id)).toContain("close-race");
  });

  it("counts coins under $100K liquidity as the blast zone when radiation is severe", () => {
    const w = falloutWarnings({ level: 80, msLeft: 365 * 86_400_000, standings: [], coins: [{ liquidityUsd: 99_999 }, { liquidityUsd: 100_000 }] });
    expect(w[0]).toMatchObject({ id: "blast-zone", severity: "danger" });
    expect(w[0]!.text).toContain("1 coin under $100K");
  });
});
