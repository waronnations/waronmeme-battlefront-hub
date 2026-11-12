import { sql } from "@/lib/db/client.server";
import { starterSeeds, slotAccepts, type AssetRecipe, type EquipSlot, type Faction, type OwnedAsset } from "./recipe";
export type { OwnedAsset };


function toAsset(r: Record<string, unknown>): OwnedAsset {
  return {
    id: Number(r["id"]),
    recipe: r["recipe"] as AssetRecipe,
    equippedSlot: (r["equipped_slot"] as EquipSlot | null) ?? null,
    nftAddress: (r["nft_address"] as string | null) ?? null,
    status: String(r["status"]),
  };
}

export async function listAssets(userId: number): Promise<OwnedAsset[]> {
  const { rows } = await sql`
    SELECT id, recipe, equipped_slot, nft_address, status FROM assets
    WHERE owner_id = ${userId} AND status = 'active'
    ORDER BY created_at DESC LIMIT 200`;
  return rows.map(toAsset);
}

/** Grants the starter kit once (idempotent via unique owner+hash). */
export async function grantStarterKit(userId: number, faction: Faction): Promise<OwnedAsset[]> {
  for (const r of starterSeeds(String(userId), faction)) {
    const { rows } = await sql`
      INSERT INTO assets (owner_id, kind, faction, rarity, tier, seed, content_hash, recipe, source)
      VALUES (${userId}, ${r.kind}, ${r.faction}, ${r.rarity}, ${r.tier}, ${r.seed}, ${r.hash}, ${JSON.stringify(r)}::jsonb, 'starter')
      ON CONFLICT (owner_id, content_hash) DO NOTHING
      RETURNING id`;
    if (rows[0]) {
      await sql`INSERT INTO asset_events (asset_id, user_id, event) VALUES (${Number(rows[0]["id"])}, ${userId}, 'granted_starter')`;
    }
  }
  return listAssets(userId);
}

export async function equipAsset(userId: number, assetId: number, slot: EquipSlot): Promise<OwnedAsset[]> {
  const { rows } = await sql`
    SELECT kind FROM assets WHERE id = ${assetId} AND owner_id = ${userId} AND status = 'active'`;
  const kind = rows[0]?.["kind"];
  if (!kind) throw new Error("Asset not found");
  if (!slotAccepts(slot, kind as AssetRecipe["kind"])) throw new Error("Asset does not fit this slot");
  await sql`UPDATE assets SET equipped_slot = NULL WHERE owner_id = ${userId} AND equipped_slot = ${slot}`;
  await sql`UPDATE assets SET equipped_slot = ${slot} WHERE id = ${assetId} AND owner_id = ${userId}`;
  await sql`INSERT INTO asset_events (asset_id, user_id, event, details) VALUES (${assetId}, ${userId}, 'equipped', ${JSON.stringify({ slot })}::jsonb)`;
  return listAssets(userId);
}
