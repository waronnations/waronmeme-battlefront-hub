import { describe, expect, it } from "vitest";
import { buildRecipe, rollRarity, slotAccepts, starterSeeds } from "@/lib/assets/recipe";

describe("asset recipes", () => {
  it("same seed gives identical asset", () => {
    expect(buildRecipe("abc", "character", "wardog")).toEqual(buildRecipe("abc", "character", "wardog"));
  });
  it("different seeds differ", () => {
    expect(buildRecipe("a", "weapon", "warcat").hash).not.toBe(buildRecipe("b", "weapon", "warcat").hash);
  });
  it("rarity thresholds", () => {
    expect(rollRarity(0)).toBe("common");
    expect(rollRarity(0.6)).toBe("rare");
    expect(rollRarity(0.9999)).toBe("mythic");
  });
  it("starter kit is three common items", () => {
    const kit = starterSeeds("42", "warcat");
    expect(kit.map((k) => k.kind)).toEqual(["character", "weapon", "map"]);
    expect(kit.every((k) => k.rarity === "common")).toBe(true);
  });
  it("only characters go in avatar slot", () => {
    expect(slotAccepts("avatar", "character")).toBe(true);
    expect(slotAccepts("avatar", "weapon")).toBe(false);
    expect(slotAccepts("map", "map")).toBe(true);
  });
});
