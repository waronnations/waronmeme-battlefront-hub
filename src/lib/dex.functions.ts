// Quick-swap market data, live multi-route quotes, and ready-to-sign swaps. No session needed:
// building a transaction for a wallet only returns data the wallet owner must still sign.
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

export const getSwapMarketFn = createServerFn({ method: "GET" }).handler(async () => {
  const { getSwapMarket } = await import("@/lib/dex/swap-market.server");
  try {
    return { ...(await getSwapMarket()), error: null as string | null };
  } catch (e) {
    console.error(e);
    return { market: {}, updatedAt: Date.now(), error: "Swap prices are unavailable right now" };
  }
});

const assetKey = z.enum(["ton", "wardog", "warcat"]);
const RoutesInput = z.object({
  from: assetKey,
  to: assetKey,
  // Rounded to 4 decimals so near-identical amounts share the server cache.
  amount: z.number().positive().max(100_000).transform((n) => Math.round(n * 10_000) / 10_000),
});

export const getSwapRoutesFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => RoutesInput.parse(i))
  .handler(async ({ data }) => {
    const { getSwapRoutes } = await import("@/lib/dex/routes.server");
    try {
      return { ...(await getSwapRoutes(data.from, data.to, data.amount)), error: null as string | null };
    } catch (e) {
      console.error(e);
      return { quotes: [], best: null, tokens: {}, updatedAt: Date.now(), error: "Live routes are unavailable right now" };
    }
  });

// Friendly (mainnet/testnet, bounceable or not) or raw workchain:hex address.
const tonAddress = z.string().regex(/^(?:[EUk0]Q[A-Za-z0-9_-]{46}|-?\d:[0-9a-fA-F]{64})$/, "Invalid wallet address");
const BuildInput = RoutesInput.extend({
  venue: z.enum(["best", "stonfi", "dedust", "tonco", "x1000"]),
  sender: tonAddress,
  slippageBps: z.number().int().min(10).max(2_000),
});

export const buildSwapTxFn = createServerFn({ method: "POST" })
  .inputValidator((i: unknown) => BuildInput.parse(i))
  .handler(async ({ data }) => {
    const { buildSwapTx } = await import("@/lib/dex/routes.server");
    try {
      return { swap: await buildSwapTx(data), error: null as string | null };
    } catch (e) {
      console.error("[buildSwapTx]", e);
      return { swap: null, error: e instanceof Error ? e.message : "Couldn't prepare the swap" };
    }
  });

export const getSwapStatusFn = createServerFn({ method: "GET" })
  .inputValidator((i: unknown) => z.object({ routeId: z.number().int().positive() }).parse(i))
  .handler(async ({ data }) => {
    const { getSwapStatus } = await import("@/lib/dex/routes.server");
    return { outcome: await getSwapStatus(data.routeId) };
  });
