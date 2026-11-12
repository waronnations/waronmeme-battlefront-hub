import { sql } from "@/lib/db/client.server";
import type { AssetRecipe, Faction } from "@/lib/assets/recipe";
import { resolveCraft, salvageValue, clampBoosts, DUST_BOOST_COST } from "./crafting";
import { ensureVaultTables } from "@/lib/vault/vault.server";

export async function getDust(userId: number): Promise<number> {
  await ensureVaultTables();
  const { rows } = await sql`SELECT dust FROM player_resources WHERE user_id = ${userId}`;
  return Number(rows[0]?.["dust"] ?? 0);
}

/** Destroys an unequipped, unminted item and returns Memetic Dust. */
export async function salvageAsset(userId: number, assetId: number) {
  await ensureVaultTables();
  const { rows } = await sql`
    UPDATE assets SET status = 'salvaged', equipped_slot = NULL
    WHERE id = ${assetId} AND owner_id = ${userId} AND status = 'active'
      AND equipped_slot IS NULL AND nft_address IS NULL
    RETURNING recipe`;
  const recipe = rows[0]?.["recipe"] as AssetRecipe | undefined;
  if (!recipe) throw new Error("Only unequipped, unminted items you own can be salvaged");
  const gained = salvageValue(recipe);
  await sql`
    INSERT INTO player_resources (user_id, dust) VALUES (${userId}, ${gained})
    ON CONFLICT (user_id) DO UPDATE SET dust = player_resources.dust + ${gained}, updated_at = NOW()`;
  await sql`INSERT INTO asset_events (asset_id, user_id, event, details) VALUES (${assetId}, ${userId}, 'salvaged', ${JSON.stringify({ dust: gained })}::jsonb)`;
  return { gained, dust: await getDust(userId) };
}

export async function craftAssets(userId: number, assetIds: number[], faction: Faction, requestedBoosts = 0) {
  const ids = [...new Set(assetIds)];
  const { rows } = await sql`
    SELECT id, recipe, nft_address FROM assets
    WHERE owner_id = ${userId} AND status = 'active' AND id = ANY(${ids}::bigint[])`;
  if (rows.length !== ids.length) throw new Error("Some items are not yours or already used");
  if (rows.some((r) => r["nft_address"])) throw new Error("Minted NFTs must be burned in your wallet before crafting");
  const inputs = rows.map((r) => r["recipe"] as AssetRecipe);

  // Spend dust up front, atomically; refunded if the craft can't happen.
  let boosts = 0;
  if (requestedBoosts > 0) {
    boosts = clampBoosts(requestedBoosts, await getDust(userId));
    if (boosts > 0) {
      const cost = boosts * DUST_BOOST_COST;
      const spent = await sql`UPDATE player_resources SET dust = dust - ${cost}, updated_at = NOW() WHERE user_id = ${userId} AND dust >= ${cost} RETURNING dust`;
      if (spent.rows.length === 0) boosts = 0;
    }
  }
  const refund = async () => {
    if (boosts > 0) await sql`UPDATE player_resources SET dust = dust + ${boosts * DUST_BOOST_COST} WHERE user_id = ${userId}`;
  };

  const roll = crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;
  const result = resolveCraft(inputs, faction, `craft:${userId}:${Date.now()}:${ids.join(",")}`, roll, { dustBoosts: boosts });
  if (!result) {
    await refund();
    throw new Error("This combination can't be crafted");
  }

  // Burn inputs only if all still active (guards double-submit).
  const burned = await sql`
    UPDATE assets SET status = 'burned', equipped_slot = NULL
    WHERE owner_id = ${userId} AND status = 'active' AND id = ANY(${ids}::bigint[]) RETURNING id`;
  if (burned.rows.length !== ids.length) {
    await refund();
    throw new Error("Crafting conflict, try again");
  }

  const r = result.recipe;
  const ins = await sql`
    INSERT INTO assets (owner_id, kind, faction, rarity, tier, seed, content_hash, recipe, source)
    VALUES (${userId}, ${r.kind}, ${r.faction}, ${r.rarity}, ${r.tier}, ${r.seed}, ${r.hash}, ${JSON.stringify(r)}::jsonb, 'craft')
    RETURNING id`;
  const resultId = Number(ins.rows[0]?.["id"]);
  await sql`INSERT INTO crafting_log (user_id, input_ids, result_id, upgraded, roll) VALUES (${userId}, ${ids}::bigint[], ${resultId}, ${result.upgraded}, ${roll})`;
  await sql`INSERT INTO asset_events (asset_id, user_id, event, details) VALUES (${resultId}, ${userId}, 'crafted', ${JSON.stringify({ inputs: ids })}::jsonb)`;
  return { resultId, recipe: r, upgraded: result.upgraded, boosts };
}

export async function craftCount(userId: number): Promise<number> {
  const { rows } = await sql`SELECT COUNT(*)::int AS n FROM crafting_log WHERE user_id = ${userId}`;
  return Number(rows[0]?.["n"] ?? 0);
}
