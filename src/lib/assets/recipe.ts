// Procedural asset recipes: a seed fully determines a character, weapon or map.
// Pure and browser-safe so server and client render identical results.

export type AssetKind = "character" | "weapon" | "map";
export type Faction = "wardog" | "warcat";
export type Rarity = "common" | "rare" | "epic" | "legendary" | "mythic";

export const RARITIES: readonly Rarity[] = ["common", "rare", "epic", "legendary", "mythic"];
// Cumulative roll thresholds out of 10_000.
export const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 6000,
  rare: 2500,
  epic: 1100,
  legendary: 350,
  mythic: 50,
};
export const RARITY_POWER: Record<Rarity, number> = {
  common: 1,
  rare: 1.4,
  epic: 2,
  legendary: 3,
  mythic: 5,
};

export const PALETTES = [
  ["#39ff88", "#0b3d24"],
  ["#ffcc33", "#4a3200"],
  ["#ff3b6b", "#4a0b1d"],
  ["#4cc9ff", "#06304a"],
  ["#b46bff", "#2a0b4a"],
  ["#ff7a1a", "#4a1e00"],
] as const;

export type AssetRecipe = {
  seed: string;
  kind: AssetKind;
  faction: Faction;
  rarity: Rarity;
  tier: number;
  palette: number;
  parts: { body: number; head: number; gear: number; mark: number };
  stats: { attack: number; defense: number; speed: number };
  hash: string;
};

/** FNV-1a 32-bit hash, hex. */
export function hashString(s: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}

function rng(seed: string) {
  let a = parseInt(hashString(seed), 16) || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rollRarity(roll: number): Rarity {
  let acc = 0;
  const n = Math.floor(roll * 10_000);
  for (const r of RARITIES) {
    acc += RARITY_WEIGHTS[r];
    if (n < acc) return r;
  }
  return "common";
}

export function buildRecipe(
  seed: string,
  kind: AssetKind,
  faction: Faction,
  opts: { rarity?: Rarity; tier?: number } = {},
): AssetRecipe {
  const r = rng(`${seed}:${kind}:${faction}`);
  const rarity = opts.rarity ?? rollRarity(r());
  const tier = opts.tier ?? 1;
  const p = RARITY_POWER[rarity] * (1 + (tier - 1) * 0.5);
  const stat = (base: number) => Math.round(base * p * (0.8 + r() * 0.4));
  const recipe = {
    seed,
    kind,
    faction,
    rarity,
    tier,
    palette: Math.floor(r() * PALETTES.length),
    parts: {
      body: Math.floor(r() * 4),
      head: Math.floor(r() * 4),
      gear: Math.floor(r() * 4),
      mark: Math.floor(r() * 4),
    },
    stats:
      kind === "map"
        ? { attack: 0, defense: stat(10), speed: 0 }
        : { attack: stat(kind === "weapon" ? 20 : 10), defense: stat(10), speed: stat(10) },
  };
  return { ...recipe, hash: hashString(JSON.stringify(recipe)) };
}

/** Starter kit every commander gets once: one character, one weapon, one map. */
export function starterSeeds(userKey: string, faction: Faction) {
  return (["character", "weapon", "map"] as const).map((kind) =>
    buildRecipe(`starter:${userKey}`, kind, faction, { rarity: "common" }),
  );
}

export const EQUIP_SLOTS = ["avatar", "skin", "weapon", "map"] as const;
export type EquipSlot = (typeof EQUIP_SLOTS)[number];

export function slotAccepts(slot: EquipSlot, kind: AssetKind): boolean {
  if (slot === "avatar" || slot === "skin") return kind === "character";
  return slot === kind;
}

export type OwnedAsset = {
  id: number;
  recipe: AssetRecipe;
  equippedSlot: EquipSlot | null;
  nftAddress: string | null;
  status: string;
};
