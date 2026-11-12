// Weapon elements: derived from the weapon's recipe hash so the same weapon
// always fights with the same element. Pure and browser-safe.
import type { AssetRecipe, Rarity } from "@/lib/assets/recipe";

export const WEAPON_ELEMENTS = ["fire", "cyber", "toxic"] as const;
export type WeaponElement = (typeof WEAPON_ELEMENTS)[number] | "kinetic";

export type ElementFx = {
  label: string;
  tracer: string;
  flash: string;
  /** Splash damage radius in metres (fire). 0 = none. */
  splashRadius: number;
  /** Fraction of hit damage dealt to enemies inside the splash radius. */
  splashPct: number;
  /** Damage per second applied for dotSeconds after a hit (toxic). */
  dotPerSec: number;
  dotSeconds: number;
  /** Camera shake strength on hit (cyber). */
  shake: number;
  /** Flat damage multiplier on direct hits. */
  damageMult: number;
};

export const ELEMENT_FX: Record<WeaponElement, ElementFx> = {
  kinetic: { label: "Kinetic", tracer: "#ffd27a", flash: "#ffaa33", splashRadius: 0, splashPct: 0, dotPerSec: 0, dotSeconds: 0, shake: 0, damageMult: 1 },
  fire: { label: "Incendiary", tracer: "#ff4d1a", flash: "#ff3300", splashRadius: 2.4, splashPct: 0.35, dotPerSec: 0, dotSeconds: 0, shake: 0.01, damageMult: 1 },
  cyber: { label: "Cyber", tracer: "#00f0ff", flash: "#00c8ff", splashRadius: 0, splashPct: 0, dotPerSec: 0, dotSeconds: 0, shake: 0.035, damageMult: 1.12 },
  toxic: { label: "Toxic", tracer: "#39ff14", flash: "#7dff3a", splashRadius: 0, splashPct: 0, dotPerSec: 9, dotSeconds: 3, shake: 0, damageMult: 1 },
};

/** Rarer weapons hit their element harder. */
export const ELEMENT_RARITY_SCALE: Record<Rarity, number> = {
  common: 1,
  rare: 1.15,
  epic: 1.3,
  legendary: 1.5,
  mythic: 1.75,
};

export function weaponElement(recipe: Pick<AssetRecipe, "kind" | "hash"> | null | undefined): WeaponElement {
  if (!recipe || recipe.kind !== "weapon") return "kinetic";
  const n = parseInt(recipe.hash.slice(0, 8), 16);
  if (!Number.isFinite(n)) return "kinetic";
  return WEAPON_ELEMENTS[n % WEAPON_ELEMENTS.length]!;
}

/** Final effect numbers for an equipped weapon. */
export function elementFxFor(recipe: Pick<AssetRecipe, "kind" | "hash" | "rarity"> | null | undefined): ElementFx & { element: WeaponElement } {
  const element = weaponElement(recipe);
  const base = ELEMENT_FX[element];
  const scale = recipe && element !== "kinetic" ? ELEMENT_RARITY_SCALE[recipe.rarity] : 1;
  return {
    ...base,
    element,
    splashPct: Math.min(0.8, base.splashPct * scale),
    dotPerSec: Math.round(base.dotPerSec * scale),
    damageMult: element === "cyber" ? Math.min(1.4, 1 + (base.damageMult - 1) * scale) : base.damageMult,
  };
}
