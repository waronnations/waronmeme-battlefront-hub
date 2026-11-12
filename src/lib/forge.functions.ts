// Forge: AI generation, provider keys, crafting and NFT minting.
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId, loadUser } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import { PLAYER_KEY_PROVIDERS, PROMPT_MAX, promptAllowed } from "@/lib/ai/providers";
import { CRAFT_MAX_INPUTS } from "@/lib/crafting/crafting";

const NO_DB = { available: false as const };

async function boot() {
  if (!hasDatabase()) return null;
  await ensureSchema();
  return requireUserId();
}

export const getForgeStatusFn = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await boot();
  if (userId == null) return { ...NO_DB, keys: [] as string[], storage: false, nft: false, crafts: 0 };
  const { listPlayerKeys, storageConfigured } = await import("@/lib/ai/generation.server");
  const { nftConfigured } = await import("@/lib/nft/nft.server");
  const { craftCount } = await import("@/lib/crafting/crafting.server");
  return {
    available: true as const,
    keys: await listPlayerKeys(userId),
    storage: storageConfigured(),
    nft: nftConfigured(),
    crafts: await craftCount(userId),
  };
});

export const savePlayerKeyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ provider: z.enum(PLAYER_KEY_PROVIDERS), apiKey: z.string().min(10).max(300) }).parse(i))
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return NO_DB;
    assertRateLimit(`pkey:${userId}`, 10, 60_000);
    const { savePlayerKey } = await import("@/lib/ai/generation.server");
    await savePlayerKey(userId, data.provider, data.apiKey);
    return { available: true as const };
  });

export const deletePlayerKeyFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ provider: z.enum(PLAYER_KEY_PROVIDERS) }).parse(i))
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return NO_DB;
    const { deletePlayerKey } = await import("@/lib/ai/generation.server");
    await deletePlayerKey(userId, data.provider);
    return { available: true as const };
  });

export const generateAssetFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        provider: z.enum(["lovable", ...PLAYER_KEY_PROVIDERS]),
        kind: z.enum(["character", "weapon", "map"]),
        faction: z.enum(["wardog", "warcat"]),
        prompt: z.string().max(PROMPT_MAX),
        payToken: z.enum(["wardog", "warcat"]),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return { ...NO_DB, error: "Saving isn't available yet" };
    if (!promptAllowed(data.prompt)) return { available: true as const, error: "That description isn't allowed. Keep it 3 to 300 characters and family-friendly." };
    assertRateLimit(`gen:${userId}`, 3, 60_000);
    const { generateAsset } = await import("@/lib/ai/generation.server");
    try {
      const res = await generateAsset({ userId, ...data });
      return { available: true as const, asset: res };
    } catch (e) {
      return { available: true as const, error: e instanceof Error ? e.message : "Generation failed" };
    }
  });

export const craftFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z
      .object({
        assetIds: z.array(z.number().int().positive()).min(1).max(CRAFT_MAX_INPUTS),
        faction: z.enum(["wardog", "warcat"]),
        dustBoosts: z.number().int().min(0).max(3).optional(),
      })
      .parse(i),
  )
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return { ...NO_DB, error: "Saving isn't available yet" };
    assertRateLimit(`craft:${userId}`, 10, 60_000);
    const { craftAssets } = await import("@/lib/crafting/crafting.server");
    try {
      return { available: true as const, result: await craftAssets(userId, data.assetIds, data.faction, data.dustBoosts ?? 0) };
    } catch (e) {
      return { available: true as const, error: e instanceof Error ? e.message : "Crafting failed" };
    }
  });

export const mintAssetFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ assetId: z.number().int().positive() }).parse(i))
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return { ...NO_DB, error: "Saving isn't available yet" };
    assertRateLimit(`mint:${userId}`, 5, 60_000);
    const user = await loadUser(userId);
    const addr = user?.walletAddress ?? null;
    if (!addr) return { available: true as const, error: "Connect your TON wallet first" };
    const { mintAsset } = await import("@/lib/nft/nft.server");
    const origin = new URL(getRequest().url).origin;
    try {
      return { available: true as const, mint: await mintAsset(userId, data.assetId, addr, origin) };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Mint failed";
      return { available: true as const, error: msg === "nft_not_configured" ? "NFT minting isn't switched on yet" : msg };
    }
  });

export const getDustFn = createServerFn({ method: "GET" }).handler(async () => {
  const userId = await boot();
  if (userId == null) return { ...NO_DB, dust: 0 };
  const { getDust } = await import("@/lib/crafting/crafting.server");
  return { available: true as const, dust: await getDust(userId) };
});

export const salvageAssetFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ assetId: z.number().int().positive() }).parse(i))
  .handler(async ({ data }) => {
    const userId = await boot();
    if (userId == null) return { ...NO_DB, error: "Saving isn't available yet" };
    assertRateLimit(`salvage:${userId}`, 20, 60_000);
    const { salvageAsset } = await import("@/lib/crafting/crafting.server");
    try {
      return { available: true as const, ...(await salvageAsset(userId, data.assetId)) };
    } catch (e) {
      return { available: true as const, error: e instanceof Error ? e.message : "Salvage failed" };
    }
  });
