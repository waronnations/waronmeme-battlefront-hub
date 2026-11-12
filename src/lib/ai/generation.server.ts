import { generateImage } from "@lovable.dev/ai-gateway";
import { sql } from "@/lib/db/client.server";
import { open, seal } from "@/lib/crypto/secret-box.server";
import { buildRecipe, hashString, type AssetKind, type Faction } from "@/lib/assets/recipe";
import { buildArtPrompt, GENERATION_COST, GENERATION_DAILY_CAP, type AiProviderId } from "./providers";

const OPENAI_COMPAT: Record<string, { url: string; model: string }> = {
  openai: { url: "https://api.openai.com/v1/images/generations", model: "gpt-image-1" },
  xai: { url: "https://api.x.ai/v1/images/generations", model: "grok-2-image" },
  openrouter: { url: "https://openrouter.ai/api/v1/images/generations", model: "openai/gpt-image-1" },
};

async function runProvider(provider: AiProviderId, prompt: string, playerKey: string | null): Promise<Uint8Array> {
  if (provider === "lovable") {
    const res = await generateImage({ model: "openai/gpt-image-2.5-flare", prompt, size: "1024x1024", quality: "low", output_format: "webp" });
    const b64 = res.data?.[0]?.b64_json;
    if (!b64) throw new Error("No image returned");
    return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  }
  const cfg = OPENAI_COMPAT[provider];
  if (!cfg || !playerKey) throw new Error("Provider key missing");
  const r = await fetch(cfg.url, {
    method: "POST",
    headers: { Authorization: `Bearer ${playerKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ model: cfg.model, prompt, n: 1, response_format: "b64_json" }),
  });
  if (!r.ok) throw new Error(`${provider} error ${r.status}`);
  const j = (await r.json()) as { data?: Array<{ b64_json?: string; url?: string }> };
  const item = j.data?.[0];
  if (item?.b64_json) return Uint8Array.from(atob(item.b64_json), (c) => c.charCodeAt(0));
  if (item?.url) return new Uint8Array(await (await fetch(item.url)).arrayBuffer());
  throw new Error("No image returned");
}

/** Pins bytes to IPFS via Pinata. Returns ipfs:// URI. */
async function pinToIpfs(bytes: Uint8Array, name: string): Promise<string> {
  const jwt = process.env["PINATA_JWT"];
  if (!jwt) throw new Error("storage_not_configured");
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array(bytes)], { type: "image/webp" }), name);
  const r = await fetch("https://api.pinata.cloud/pinning/pinFileToIPFS", { method: "POST", headers: { Authorization: `Bearer ${jwt}` }, body: form });
  if (!r.ok) throw new Error(`IPFS pin failed ${r.status}`);
  const j = (await r.json()) as { IpfsHash: string };
  return `ipfs://${j.IpfsHash}`;
}

export function storageConfigured(): boolean {
  return Boolean(process.env["PINATA_JWT"]);
}

export async function savePlayerKey(userId: number, provider: string, apiKey: string) {
  const ct = await seal(apiKey);
  await sql`INSERT INTO provider_credentials (user_id, provider, ciphertext) VALUES (${userId}, ${provider}, ${ct})
    ON CONFLICT (user_id, provider) DO UPDATE SET ciphertext = EXCLUDED.ciphertext, updated_at = NOW()`;
}

export async function listPlayerKeys(userId: number): Promise<string[]> {
  const { rows } = await sql`SELECT provider FROM provider_credentials WHERE user_id = ${userId}`;
  return rows.map((r) => String(r["provider"]));
}

export async function deletePlayerKey(userId: number, provider: string) {
  await sql`DELETE FROM provider_credentials WHERE user_id = ${userId} AND provider = ${provider}`;
}

export async function generateAsset(input: {
  userId: number;
  provider: AiProviderId;
  kind: AssetKind;
  faction: Faction;
  prompt: string;
  payToken: "wardog" | "warcat";
}) {
  const { userId, provider, kind, faction, prompt, payToken } = input;

  const today = await sql`SELECT COUNT(*)::int AS n FROM ai_generation_jobs WHERE user_id = ${userId} AND created_at > NOW() - INTERVAL '1 day' AND status <> 'failed'`;
  if (Number(today.rows[0]?.["n"] ?? 0) >= GENERATION_DAILY_CAP) throw new Error("Daily generation limit reached");

  let playerKey: string | null = null;
  if (provider !== "lovable") {
    const { rows } = await sql`SELECT ciphertext FROM provider_credentials WHERE user_id = ${userId} AND provider = ${provider}`;
    if (!rows[0]) throw new Error("Connect your key for this provider first");
    playerKey = await open(String(rows[0]["ciphertext"]));
  }
  const cost = provider === "lovable" ? GENERATION_COST.platform : GENERATION_COST.ownKey;

  // Charge atomically; refunded on failure.
  const charged =
    payToken === "wardog"
      ? await sql`UPDATE progress SET wardog_tokens = wardog_tokens - ${cost} WHERE user_id = ${userId} AND wardog_tokens >= ${cost} RETURNING user_id`
      : await sql`UPDATE progress SET warcat_tokens = warcat_tokens - ${cost} WHERE user_id = ${userId} AND warcat_tokens >= ${cost} RETURNING user_id`;
  if (!charged.rows[0]) throw new Error(`Not enough ${payToken.toUpperCase()}`);

  const job = await sql`INSERT INTO ai_generation_jobs (user_id, provider, kind, prompt, cost, cost_token) VALUES (${userId}, ${provider}, ${kind}, ${prompt}, ${cost}, ${payToken}) RETURNING id`;
  const jobId = Number(job.rows[0]?.["id"]);

  try {
    const bytes = await runProvider(provider, buildArtPrompt(kind, faction, prompt), playerKey);
    const seed = `ai:${userId}:${jobId}`;
    const uri = await pinToIpfs(bytes, `${seed}.webp`);
    const recipe = buildRecipe(seed, kind, faction);
    const contentHash = hashString(uri + recipe.hash);
    await sql`INSERT INTO storage_refs (content_hash, provider, uri, bytes) VALUES (${contentHash}, 'ipfs', ${uri}, ${bytes.length}) ON CONFLICT DO NOTHING`;
    const a = await sql`
      INSERT INTO assets (owner_id, kind, faction, rarity, tier, seed, content_hash, recipe, storage_uri, source)
      VALUES (${userId}, ${kind}, ${faction}, ${recipe.rarity}, 1, ${seed}, ${contentHash}, ${JSON.stringify(recipe)}::jsonb, ${uri}, 'ai')
      RETURNING id`;
    const assetId = Number(a.rows[0]?.["id"]);
    await sql`UPDATE ai_generation_jobs SET status = 'done', asset_id = ${assetId} WHERE id = ${jobId}`;
    await sql`INSERT INTO asset_events (asset_id, user_id, event, details) VALUES (${assetId}, ${userId}, 'generated', ${JSON.stringify({ provider })}::jsonb)`;
    return { assetId, recipe, storageUri: uri };
  } catch (err) {
    console.error("generation failed", err);
    if (payToken === "wardog") await sql`UPDATE progress SET wardog_tokens = wardog_tokens + ${cost} WHERE user_id = ${userId}`;
    else await sql`UPDATE progress SET warcat_tokens = warcat_tokens + ${cost} WHERE user_id = ${userId}`;
    const msg = err instanceof Error ? err.message : "failed";
    await sql`UPDATE ai_generation_jobs SET status = 'failed', error = ${msg.slice(0, 300)} WHERE id = ${jobId}`;
    throw new Error(msg === "storage_not_configured" ? "Image storage isn't set up yet. Your tokens were refunded." : "Generation failed. Your tokens were refunded.");
  }
}
