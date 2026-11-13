// Bunker LP: public pool board, ready-to-sign add-liquidity transactions, and Doomsday pledges.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const tonAddress = z.string().regex(/^(?:[EUk0]Q[A-Za-z0-9_-]{46}|-?\d:[0-9a-fA-F]{64})$/, "Invalid address");

function message(e: unknown, fallback: string) {
  const m = e instanceof Error ? e.message : "";
  // Our own guard messages are written for players; anything internal gets the fallback.
  return m && /[A-Z ]/.test(m) && !/^(DB|Neon|tonapi_|lp_balance_unavailable)/.test(m) ? m : fallback;
}

/** Public: every board coin's pool metrics, fee split and bunker totals. */
export const getLpBoardFn = createServerFn({ method: "GET" }).handler(async () => {
  const { lpBoard, recheckStalePledges } = await import("@/lib/bunker/lp.server");
  const { hasDatabase } = await import("@/lib/db.server");
  const db = hasDatabase();
  try {
    if (db) await recheckStalePledges(3).catch((e) => console.error("[bunker] recheck", e));
    return { ...(await lpBoard({ withBunker: db })), error: null as string | null };
  } catch (e) {
    console.error(e);
    return { rows: [], updatedAt: Date.now(), until: 0, error: "Pool data is unavailable right now" };
  }
});

const ProvideInput = z.object({
  master: tonAddress,
  wallet: tonAddress,
  tonAmount: z.number().positive().max(10_000).transform((n) => Math.round(n * 1000) / 1000),
});

/** Builds the two-message add-liquidity transaction the player signs in their own wallet. */
export const buildProvideLpFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => ProvideInput.parse(i))
  .handler(async ({ data }) => {
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    assertRateLimit(`lp:build:${data.wallet}`, 10, 60_000);
    const { buildProvideLiquidity } = await import("@/lib/bunker/lp.server");
    try {
      return { plan: await buildProvideLiquidity(data), error: null as string | null };
    } catch (e) {
      console.error(e);
      return { plan: null, error: message(e, "Couldn't build the liquidity transaction") };
    }
  });

async function signedIn() {
  const { hasDatabase, ensureSchema } = await import("@/lib/db.server");
  if (!hasDatabase()) throw new Error("database_not_configured");
  const { requireUserId } = await import("@/lib/auth.server");
  const userId = await requireUserId();
  await ensureSchema();
  return userId;
}

/** The player's pledges, re-checked against their wallet's LP balance. */
export const getMyBunkerFn = createServerFn({ method: "GET" }).handler(async () => {
  let userId: number;
  try {
    userId = await signedIn();
  } catch {
    return { signedIn: false as const, pledges: [], error: null as string | null };
  }
  const { myPledges } = await import("@/lib/bunker/lp.server");
  try {
    return { signedIn: true as const, pledges: await myPledges(userId), error: null as string | null };
  } catch (e) {
    console.error(e);
    return { signedIn: true as const, pledges: [], error: "Couldn't read your bunker" };
  }
});

const MasterInput = z.object({ master: tonAddress });

/** LP the linked wallet holds in the coin's bunker pool right now. */
export const getWalletLpFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => MasterInput.parse(i))
  .handler(async ({ data }) => {
    const userId = await signedIn();
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    assertRateLimit(`lp:wallet:${userId}`, 20, 60_000);
    const { walletLp } = await import("@/lib/bunker/lp.server");
    try {
      return { ...(await walletLp(userId, data.master)), error: null as string | null };
    } catch (e) {
      console.error(e);
      return { pool: null, units: "0", valueUsd: 0, error: message(e, "Couldn't read your LP balance") };
    }
  });

/** Pledges the linked wallet's LP until Doomsday. */
export const pledgeLpFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => MasterInput.parse(i))
  .handler(async ({ data }) => {
    const userId = await signedIn();
    const { assertRateLimit } = await import("@/lib/rate-limit.server");
    assertRateLimit(`lp:pledge:${userId}`, 6, 60_000);
    const { pledgeLp } = await import("@/lib/bunker/lp.server");
    try {
      return { pledges: await pledgeLp(userId, data.master), error: null as string | null };
    } catch (e) {
      console.error(e);
      return { pledges: null, error: message(e, "Couldn't record the pledge") };
    }
  });
