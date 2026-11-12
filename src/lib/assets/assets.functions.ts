import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { ensureSchema, hasDatabase } from "@/lib/db.server";
import { requireUserId } from "@/lib/auth.server";
import { assertRateLimit } from "@/lib/rate-limit.server";
import { equipAsset, grantStarterKit, listAssets } from "./assets.server";
import { EQUIP_SLOTS } from "./recipe";

export const getMyAssetsFn = createServerFn({ method: "GET" }).handler(async () => {
  if (!hasDatabase()) return { available: false as const, assets: [] };
  await ensureSchema();
  const userId = await requireUserId();
  return { available: true as const, assets: await listAssets(userId) };
});

export const claimStarterKitFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => z.object({ faction: z.enum(["wardog", "warcat"]) }).parse(i))
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, assets: [] };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`starter:${userId}`, 5, 60_000);
    return { available: true as const, assets: await grantStarterKit(userId, data.faction) };
  });

export const equipAssetFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) =>
    z.object({ assetId: z.number().int().positive(), slot: z.enum(EQUIP_SLOTS) }).parse(i),
  )
  .handler(async ({ data }) => {
    if (!hasDatabase()) return { available: false as const, assets: [] };
    await ensureSchema();
    const userId = await requireUserId();
    assertRateLimit(`equip:${userId}`, 30, 60_000);
    return { available: true as const, assets: await equipAsset(userId, data.assetId, data.slot) };
  });
