// TON NFT (TEP-62/64) minting into the War On Nations collection. GetGems indexes it automatically.
import { Address, beginCell, internal, toNano, SendMode } from "@ton/core";
import { TonClient, WalletContractV4 } from "@ton/ton";
import { mnemonicToPrivateKey } from "@ton/crypto";
import { sql } from "@/lib/db/client.server";
import type { AssetRecipe } from "@/lib/assets/recipe";

export function nftConfigured(): boolean {
  return Boolean(process.env["NFT_COLLECTION_ADDRESS"] && process.env["NFT_OWNER_MNEMONIC"]);
}

function tonapiHeaders(): Record<string, string> {
  const k = process.env["TON_API_KEY"];
  return k ? { Authorization: `Bearer ${k}` } : {};
}

/** TEP-64 metadata served from /api/public/nft/$assetId */
export async function nftMetadata(assetId: number, origin: string) {
  const { rows } = await sql`SELECT recipe, storage_uri FROM assets WHERE id = ${assetId}`;
  const row = rows[0];
  if (!row) return null;
  const r = row["recipe"] as AssetRecipe;
  const image = row["storage_uri"]
    ? String(row["storage_uri"]).replace("ipfs://", "https://ipfs.io/ipfs/")
    : `${origin}/api/public/nft/${assetId}/image`;
  return {
    name: `${r.faction === "wardog" ? "WarDog" : "WarCat"} ${r.kind} #${assetId}`,
    description: `War On Nations ${r.rarity} tier ${r.tier} ${r.kind}. Recipe hash ${r.hash}.`,
    image,
    attributes: [
      { trait_type: "Kind", value: r.kind },
      { trait_type: "Faction", value: r.faction },
      { trait_type: "Rarity", value: r.rarity },
      { trait_type: "Tier", value: r.tier },
      { trait_type: "Attack", value: r.stats.attack },
      { trait_type: "Defense", value: r.stats.defense },
      { trait_type: "Speed", value: r.stats.speed },
    ],
  };
}

/** Server mints from the collection owner wallet straight to the player's wallet. */
export async function mintAsset(userId: number, assetId: number, ownerWallet: string, origin: string) {
  const collection = process.env["NFT_COLLECTION_ADDRESS"];
  const mnemonic = process.env["NFT_OWNER_MNEMONIC"];
  if (!collection || !mnemonic) throw new Error("nft_not_configured");

  const { rows } = await sql`SELECT id, nft_address, status FROM assets WHERE id = ${assetId} AND owner_id = ${userId}`;
  const a = rows[0];
  if (!a || a["status"] !== "active") throw new Error("Item not found");
  if (a["nft_address"]) throw new Error("Already minted");

  const existing = await sql`SELECT item_index, status FROM nft_mints WHERE asset_id = ${assetId}`;
  if (existing.rows[0]) throw new Error("Mint already in progress");
  const idx = await sql`SELECT nextval('nft_item_index_seq') AS i`;
  const itemIndex = BigInt(String(idx.rows[0]?.["i"]));
  await sql`INSERT INTO nft_mints (asset_id, user_id, item_index, owner_wallet) VALUES (${assetId}, ${userId}, ${itemIndex.toString()}, ${ownerWallet})`;

  const content = beginCell().storeBuffer(Buffer.from(`${origin}/api/public/nft/${assetId}`)).endCell();
  const itemMsg = beginCell().storeAddress(Address.parse(ownerWallet)).storeRef(content).endCell();
  const body = beginCell()
    .storeUint(1, 32) // op: deploy new nft
    .storeUint(0, 64)
    .storeUint(itemIndex, 64)
    .storeCoins(toNano("0.05"))
    .storeRef(itemMsg)
    .endCell();

  const net = process.env["TON_NETWORK"] === "testnet" ? "testnet." : "";
  const client = new TonClient({ endpoint: `https://${net}toncenter.com/api/v2/jsonRPC`, apiKey: process.env["TONCENTER_API_KEY"] });
  const key = await mnemonicToPrivateKey(mnemonic.trim().split(/\s+/));
  const wallet = client.open(WalletContractV4.create({ workchain: 0, publicKey: key.publicKey }));
  const seqno = await wallet.getSeqno();
  await wallet.sendTransfer({
    seqno,
    secretKey: key.secretKey,
    sendMode: SendMode.PAY_GAS_SEPARATELY + SendMode.IGNORE_ERRORS,
    messages: [internal({ to: Address.parse(collection), value: toNano("0.08"), body })],
  });
  return { itemIndex: itemIndex.toString() };
}

/** Confirms pending mints and syncs ownership (sold on GetGems -> leaves inventory). */
export async function syncNfts(limit = 50) {
  const collection = process.env["NFT_COLLECTION_ADDRESS"];
  if (!collection) return { checked: 0 };
  const { rows } = await sql`
    SELECT m.asset_id, m.item_index, m.user_id, a.nft_address FROM nft_mints m JOIN assets a ON a.id = m.asset_id
    WHERE a.status = 'active' ORDER BY m.confirmed_at NULLS FIRST LIMIT ${limit}`;
  const net = process.env["TON_NETWORK"] === "testnet" ? "testnet." : "";
  for (const r of rows) {
    const res = await fetch(`https://${net}tonapi.io/v2/nfts/collections/${collection}/items?offset=${r["item_index"]}&limit=1`, { headers: tonapiHeaders() });
    if (!res.ok) continue;
    const j = (await res.json()) as { nft_items?: Array<{ address: string; index: number; owner?: { address: string } }> };
    const item = j.nft_items?.find((x) => String(x.index) === String(r["item_index"]));
    if (!item) continue;
    await sql`UPDATE assets SET nft_address = ${item.address} WHERE id = ${r["asset_id"]} AND nft_address IS NULL`;
    await sql`UPDATE nft_mints SET status = 'confirmed', confirmed_at = COALESCE(confirmed_at, NOW()) WHERE asset_id = ${r["asset_id"]}`;
    const owner = item.owner?.address;
    if (owner) {
      const u = await sql`SELECT id FROM users WHERE wallet_address IS NOT NULL AND (wallet_address = ${owner}) LIMIT 1`;
      const newOwner = u.rows[0] ? Number(u.rows[0]["id"]) : null;
      if (newOwner && newOwner !== Number(r["user_id"])) {
        await sql`UPDATE assets SET owner_id = ${newOwner}, equipped_slot = NULL WHERE id = ${r["asset_id"]}`;
        await sql`INSERT INTO asset_events (asset_id, user_id, event) VALUES (${r["asset_id"]}, ${newOwner}, 'transferred_in')`;
      } else if (!newOwner) {
        await sql`UPDATE assets SET status = 'external', equipped_slot = NULL WHERE id = ${r["asset_id"]}`;
      }
    }
  }
  return { checked: rows.length };
}

export function getgemsUrl(nftAddress: string): string {
  return `https://getgems.io/nft/${nftAddress}`;
}
