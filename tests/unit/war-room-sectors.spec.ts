import { describe, expect, it } from "vitest";
import { factionSectors, totalVolume } from "@/lib/war-room/sectors";
import { WARDOG_CA } from "@/lib/tokens";
import { radiationLevel, volumeShielding, SHIELD_MAX } from "@/lib/apocalypse/engine";

const coin = (symbol: string, volume24hUsd: number, master = `EQ${symbol}`, liquidityUsd = 10_000) => ({ symbol, master, volume24hUsd, liquidityUsd, priceUsd: 1 });

describe("War Room sectors", () => {
  it("maps the four factions and splits dominance by 24h volume", () => {
    const s = factionSectors([coin("UTYA", 300), coin("WARDOG", 100, WARDOG_CA), coin("GRAM", 600), coin("DOGS", 9999)]);
    expect(s.map((x) => x.id)).toEqual(["utya", "wardog", "warcat", "gram"]);
    expect(s.find((x) => x.id === "gram")!.dominance).toBeCloseTo(0.6);
    expect(s.find((x) => x.id === "warcat")!.volume24hUsd).toBe(0);
    expect(totalVolume(s)).toBe(1000);
  });

  it("matches WARDOG by its contract even if another coin copies the symbol", () => {
    const s = factionSectors([coin("WARDOG", 5, "EQfake", 1e9), coin("WARDOG", 50, WARDOG_CA)]);
    expect(s.find((x) => x.id === "wardog")!.volume24hUsd).toBe(50);
  });
});

describe("trade shielding", () => {
  it("never removes more than 15 radiation points", () => {
    expect(SHIELD_MAX).toBe(15);
    expect(volumeShielding(1e12)).toBeLessThanOrEqual(15);
    expect(volumeShielding(0)).toBe(0);
  });

  it("lowers radiation when factions trade", () => {
    const now = Date.UTC(2026, 5, 1);
    const coins = [{ liquidityUsd: 1000, volume24hUsd: 500 }];
    const base = radiationLevel({ now, coins }).level;
    const shielded = radiationLevel({ now, coins, factionVolumeUsd: 1_000_000 }).level;
    expect(base - shielded).toBeGreaterThanOrEqual(14);
  });
});
