// Crafting / evolution rules. Pure and shared by client (preview) and server (authority).
import {
  buildRecipe,
  RARITIES,
  RARITY_POWER,
  type AssetRecipe,
  type Faction,
  type Rarity,
} from "@/lib/assets/recipe";

export const CRAFT_MIN_INPUTS = 3;
export const CRAFT_MAX_INPUTS = 8;
export const MAX_TIER = 5;
export const TIER_NAMES = ["Recruit", "Veteran", "Elite", "Mythic", "Warlord"] as const;

export type CraftInput = Pick<AssetRecipe, "rarity" | "tier" | "kind">;

export type CraftPreview =
  | { ok: false; reason: string; progress: number }
  | {
      ok: true;
      targetTier: number;
      baseRarity: Rarity;
      upgradeRarity: Rarity;
      upgradeChance: number;
      progress: number;
    };

export function craftScore(inputs: CraftInput[]): number {
  return inputs.reduce((s, i) => s + RARITY_POWER[i.rarity] * i.tier, 0);
}

function bestRarity(inputs: CraftInput[]): Rarity {
  return inputs.reduce<Rarity>(
    (best, i) => (RARITIES.indexOf(i.rarity) > RARITIES.indexOf(best) ? i.rarity : best),
    "common",
  );
}

/** Memetic Dust gained by salvaging one item. */
export const SALVAGE_DUST: Record<Rarity, number> = { common: 5, rare: 12, epic: 30, legendary: 75, mythic: 180 };
/** Dust spent per boost; each boost adds DUST_BOOST_CHANCE to the rarity jump chance. */
export const DUST_BOOST_COST = 50;
export const DUST_BOOST_CHANCE = 0.1;
export const MAX_DUST_BOOSTS = 3;
export const MAX_UPGRADE_CHANCE = 0.95;

export function salvageValue(item: Pick<AssetRecipe, "rarity" | "tier">): number {
  return SALVAGE_DUST[item.rarity] * Math.max(1, item.tier);
}

export function clampBoosts(boosts: number, dust: number): number {
  return Math.max(0, Math.min(MAX_DUST_BOOSTS, Math.floor(boosts), Math.floor(dust / DUST_BOOST_COST)));
}

/** Min/max stats a crafted fighter of this rarity and tier can roll (matches buildRecipe). */
export function statRange(rarity: Rarity, tier: number) {
  const p = RARITY_POWER[rarity] * (1 + (tier - 1) * 0.5);
  const r = (base: number): [number, number] => [Math.round(base * p * 0.8), Math.round(base * p * 1.2)];
  return { attack: r(10), defense: r(10), speed: r(10) };
}

export function previewCraft(inputs: CraftInput[], opts: { dustBoosts?: number } = {}): CraftPreview {
  const progress = Math.min(1, inputs.length / CRAFT_MIN_INPUTS);
  if (inputs.length < CRAFT_MIN_INPUTS) return { ok: false, reason: `Add at least ${CRAFT_MIN_INPUTS} items`, progress };
  if (inputs.length > CRAFT_MAX_INPUTS) return { ok: false, reason: `At most ${CRAFT_MAX_INPUTS} items`, progress: 1 };
  if (!inputs.some((i) => i.kind === "character")) return { ok: false, reason: "Include at least one fighter", progress };
  const maxTier = Math.max(...inputs.map((i) => i.tier));
  if (maxTier >= MAX_TIER) return { ok: false, reason: "Already at Warlord tier", progress: 1 };
  const targetTier = maxTier + 1;
  const baseRarity = bestRarity(inputs);
  const idx = RARITIES.indexOf(baseRarity);
  const upgradeRarity = RARITIES[Math.min(RARITIES.length - 1, idx + 1)] ?? baseRarity;
  // More and rarer inputs push the chance of a rarity jump up, capped at 95%.
  const boosts = Math.max(0, Math.min(MAX_DUST_BOOSTS, Math.floor(opts.dustBoosts ?? 0)));
  const upgradeChance =
    upgradeRarity === baseRarity
      ? 0
      : Math.min(MAX_UPGRADE_CHANCE, craftScore(inputs) / (targetTier * 6) + boosts * DUST_BOOST_CHANCE);
  return { ok: true, targetTier, baseRarity, upgradeRarity, upgradeChance, progress: 1 };
}

/** Server-side resolution. `roll` in [0,1). */
export function resolveCraft(
  inputs: CraftInput[],
  faction: Faction,
  seed: string,
  roll: number,
  opts: { dustBoosts?: number } = {},
): { recipe: AssetRecipe; upgraded: boolean } | null {
  const p = previewCraft(inputs, opts);
  if (!p.ok) return null;
  const upgraded = roll < p.upgradeChance;
  const recipe = buildRecipe(seed, "character", faction, {
    rarity: upgraded ? p.upgradeRarity : p.baseRarity,
    tier: p.targetTier,
  });
  return { recipe, upgraded };
}
