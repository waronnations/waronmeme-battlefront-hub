import { describe, expect, it } from "vitest";
import { previewCraft, resolveCraft } from "@/lib/crafting/crafting";
import { assignNationLeaders, rankForWealth } from "@/lib/wealth/wealth";
import {
  classifyTier,
  convictionPayouts,
  isHealthy,
  nextWeeklyBattle,
  pickApocalypseWinner,
  type MarketCoin,
} from "@/lib/war-cycle/cycle";
import { eligibleCoins, randomPack, validateSelection } from "@/lib/packs/packs";

const c = (rarity: "common" | "rare" | "epic", kind: "character" | "weapon" = "character", tier = 1) => ({ rarity, kind, tier });

describe("crafting", () => {
  it("needs 3 items including a fighter", () => {
    expect(previewCraft([c("common"), c("common")]).ok).toBe(false);
    expect(previewCraft([c("common", "weapon"), c("common", "weapon"), c("common", "weapon")]).ok).toBe(false);
    expect(previewCraft([c("common"), c("common"), c("common")]).ok).toBe(true);
  });
  it("result is one tier higher", () => {
    const r = resolveCraft([c("common", "character", 2), c("common"), c("common")], "wardog", "s", 0.99)!;
    expect(r.recipe.tier).toBe(3);
    expect(r.upgraded).toBe(false);
  });
  it("low roll jumps rarity", () => {
    const r = resolveCraft([c("rare"), c("rare"), c("rare"), c("rare")], "warcat", "s", 0)!;
    expect(r.recipe.rarity).toBe("epic");
  });
});

describe("wealth", () => {
  it("ranks by holdings", () => {
    expect(rankForWealth(0).rank).toBe("Grunt");
    expect(rankForWealth(1000).rank).toBe("Captain");
    expect(rankForWealth(600_000).next).toBeNull();
  });
  it("richest eligible holder leads the nation", () => {
    const m = assignNationLeaders([
      { userId: 1, nationId: 7, avgUsd24h: 500, hoursTracked: 48, flagged: false },
      { userId: 2, nationId: 7, avgUsd24h: 900, hoursTracked: 48, flagged: false },
      { userId: 3, nationId: 7, avgUsd24h: 9999, hoursTracked: 2, flagged: false },
      { userId: 4, nationId: 7, avgUsd24h: 9999, hoursTracked: 48, flagged: true },
    ]);
    expect(m.get(7)).toBe(2);
  });
});

const coin = (o: Partial<MarketCoin>): MarketCoin => ({
  master: "m", symbol: "X", name: "X", image: null, priceUsd: 1, liquidityUsd: 50_000, volume24hUsd: 5_000, blacklisted: false, taxable: false, ...o,
});

describe("war cycle", () => {
  it("tiers by liquidity", () => {
    expect(classifyTier(1_000)).toBeNull();
    expect(classifyTier(10_000)).toBe("recruit");
    expect(classifyTier(200_000)).toBe("captain");
    expect(classifyTier(2_000_000)).toBe("admiral");
  });
  it("rejects low-activity coins", () => {
    expect(isHealthy(coin({ volume24hUsd: 10 }))).toBe(false);
    expect(isHealthy(coin({ blacklisted: true }))).toBe(false);
  });
  it("weekly battle is next Sunday 18:00 UTC", () => {
    const sundayNoon = Date.UTC(2026, 10, 8, 12);
    expect(nextWeeklyBattle(sundayNoon)).toBe(Date.UTC(2026, 10, 8, 18));
    expect(nextWeeklyBattle(Date.UTC(2026, 10, 8, 19))).toBe(Date.UTC(2026, 10, 15, 18));
  });
  it("conviction uses square root so whales don't take everything", () => {
    const at = Date.UTC(2027, 0, 1);
    const longAgo = at - 60 * 86_400_000;
    const p = convictionPayouts(100, [
      { userId: 1, amount: 10_000, heldSinceMs: longAgo },
      { userId: 2, amount: 100, heldSinceMs: longAgo },
    ], at);
    expect(Math.round(p.get(1)!)).toBe(91);
    expect(Math.round(p.get(2)!)).toBe(9);
  });
  it("winner follows the published formula", () => {
    expect(pickApocalypseWinner([
      { master: "a", convictionHolders: 10, liquidityUsd: 1e6, volume24hUsd: 1e5 },
      { master: "b", convictionHolders: 100, liquidityUsd: 1e5, volume24hUsd: 1e4 },
    ])).toBe("b");
  });
});

describe("packs", () => {
  it("only healthy coins of the tier are eligible", () => {
    const pool = eligibleCoins([coin({ master: "a" }), coin({ master: "b", volume24hUsd: 0 }), coin({ master: "c", liquidityUsd: 5e6 })], "recruit");
    expect(pool.map((x) => x.master)).toEqual(["a"]);
  });
  it("random pack has distinct coins of the right size", () => {
    const pool = Array.from({ length: 30 }, (_, i) => coin({ master: `m${i}` }));
    const pack = randomPack(pool, 10, 42);
    expect(new Set(pack.map((x) => x.master)).size).toBe(10);
  });
  it("selection must match size exactly", () => {
    const pool = Array.from({ length: 12 }, (_, i) => coin({ master: `m${i}` }));
    expect(validateSelection(["m1"], pool, 10)).toMatch(/exactly/);
    expect(validateSelection(pool.slice(0, 10).map((x) => x.master), pool, 10)).toBeNull();
  });
});
