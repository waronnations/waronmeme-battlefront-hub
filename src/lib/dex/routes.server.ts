// Live multi-route quotes from swap.coffee (routing + tokens APIs). Server-only.
import { getTonPriceUsd } from "@/lib/market/market.server";
import { COFFEE_API, COFFEE_NATIVE, swapAssets, type SwapAssetKey } from "./coffeeswap";
import {
  DIRECT_MAX_LENGTH,
  VENUES,
  checkSwapTxs,
  curveQuote,
  graduationOf,
  pickBest,
  safetyOf,
  summarizeCoffeeRoute,
  swapOutcome,
  venueById,
  type CoffeeJetton,
  type CoffeeRoute,
  type Graduation,
  type RouteQuote,
  type Safety,
  type SwapOutcome,
  type VenueId,
} from "./routes";
import type { CoffeeTx, TonConnectSwapRequest } from "./coffeeswap";

const TOKENS_API = "https://tokens.swap.coffee/api/v3";
const ROUTE_TTL_MS = 20_000;
const TOKEN_TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;

export type TokenIntel = { safety: Safety; graduation: Graduation; priceUsd: number };
export type SwapRoutes = {
  quotes: RouteQuote[];
  best: VenueId | null;
  tokens: Partial<Record<SwapAssetKey, TokenIntel>>;
  updatedAt: number;
};

const routeCache = new Map<string, { at: number; data: SwapRoutes }>();
const tokenCache = new Map<string, { at: number; data: CoffeeJetton | null }>();

async function getJson<T>(url: string, init?: RequestInit): Promise<T | null> {
  try {
    const r = await fetch(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

async function coffeeJetton(address: string): Promise<CoffeeJetton | null> {
  const hit = tokenCache.get(address);
  if (hit && Date.now() - hit.at < TOKEN_TTL_MS) return hit.data;
  const data = await getJson<CoffeeJetton>(`${TOKENS_API}/jettons/${encodeURIComponent(address)}`);
  tokenCache.set(address, { at: Date.now(), data });
  return data;
}

function routeBody(from: string, to: string, amount: number, dexes?: string[]) {
  return JSON.stringify({
    input_token: { blockchain: "ton", address: from },
    output_token: { blockchain: "ton", address: to },
    input_amount: amount,
    ...(dexes ? { pool_selector: { dexes }, max_length: DIRECT_MAX_LENGTH } : {}),
  });
}

export async function getSwapRoutes(fromKey: SwapAssetKey, toKey: SwapAssetKey, amount: number): Promise<SwapRoutes> {
  const assets = swapAssets();
  const from = assets.find((a) => a.key === fromKey);
  const to = assets.find((a) => a.key === toKey);
  if (!from?.address || !to?.address || from.key === to.key) throw new Error("Unsupported pair");

  const key = `${fromKey}:${toKey}:${amount}`;
  const hit = routeCache.get(key);
  if (hit && Date.now() - hit.at < ROUTE_TTL_MS) return hit.data;

  const jettonSides = [from, to].filter((a) => a.address !== COFFEE_NATIVE);
  const [gramUsd, ...infos] = await Promise.all([getTonPriceUsd(), ...jettonSides.map((a) => coffeeJetton(a.address!))]);

  const tokens: SwapRoutes["tokens"] = { ton: { safety: safetyOf("WHITELISTED"), graduation: { status: "dex" }, priceUsd: gramUsd } };
  jettonSides.forEach((a, i) => {
    const j = infos[i] ?? null;
    tokens[a.key] = { safety: safetyOf(j?.verification), graduation: graduationOf(j), priceUsd: Number(j?.market_stats?.price_usd ?? 0) };
  });

  const blocked = jettonSides.find((a) => !tokens[a.key]!.safety.routable);
  let quotes: RouteQuote[];
  if (blocked) {
    const reason = `$${blocked.symbol} is ${tokens[blocked.key]!.safety.label.toLowerCase()} — routes disabled`;
    quotes = VENUES.map((v) => ({ venue: v.id, ok: false as const, reason }));
  } else {
    quotes = await Promise.all(
      VENUES.map(async (v): Promise<RouteQuote> => {
        if (v.kind === "memepad") {
          const intel = tokens[to.key]!;
          return curveQuote({ amountIn: amount, gramUsd, tokenUsd: intel.priceUsd, graduation: intel.graduation, toSymbol: to.symbol });
        }
        const r = await getJson<CoffeeRoute>(`${COFFEE_API}/v1/route`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: routeBody(from.address!, to.address!, amount, v.dexes),
        });
        if (!r) return { venue: v.id, ok: false, reason: "Route service didn't answer — try again" };
        return summarizeCoffeeRoute(v.id, r, v.dexes);
      }),
    );
  }

  const data: SwapRoutes = { quotes, best: pickBest(quotes), tokens, updatedAt: Date.now() };
  routeCache.set(key, { at: Date.now(), data });
  if (routeCache.size > 200) routeCache.delete(routeCache.keys().next().value!);
  return data;
}

// ── In-game execution ─────────────────────────────────────────────────
export type BuiltSwap = { request: TonConnectSwapRequest; routeId: number | null; amountOut: number; gasGram: number };

/**
 * Re-quotes the chosen venue right now and asks swap.coffee to build the transaction for the
 * player's wallet. Same safety gates as the quotes, plus a hard cap on the GRAM the wallet sends.
 */
export async function buildSwapTx(input: {
  from: SwapAssetKey;
  to: SwapAssetKey;
  amount: number;
  venue: VenueId;
  sender: string;
  slippageBps: number;
}): Promise<BuiltSwap> {
  const venue = venueById(input.venue);
  if (venue.kind === "memepad") throw new Error("Curve buys aren't available in-game yet");
  const assets = swapAssets();
  const from = assets.find((a) => a.key === input.from);
  const to = assets.find((a) => a.key === input.to);
  if (!from?.address || !to?.address || from.key === to.key) throw new Error("Unsupported pair");
  if (from.address !== COFFEE_NATIVE) throw new Error("Only GRAM can be spent from the quick swap");

  for (const a of [from, to].filter((x) => x.address !== COFFEE_NATIVE)) {
    const safety = safetyOf((await coffeeJetton(a.address!))?.verification);
    if (!safety.routable) throw new Error(`$${a.symbol} is ${safety.label.toLowerCase()} — trading disabled`);
  }

  const route = await getJson<CoffeeRoute>(`${COFFEE_API}/v1/route`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: routeBody(from.address, to.address, input.amount, venue.dexes),
  });
  const quote = summarizeCoffeeRoute(venue.id, route, venue.dexes);
  if (!quote.ok) throw new Error(quote.reason);

  const built = await getJson<{ route_id?: number; transactions?: CoffeeTx[] }>(`${COFFEE_API}/v2/route/transactions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ sender_address: input.sender, slippage: input.slippageBps / 10_000, paths: route!.paths }),
  });
  if (!built?.transactions?.length) throw new Error("Couldn't prepare the swap — try again");
  return {
    request: checkSwapTxs(built.transactions, input.amount, quote.gasGram),
    routeId: built.route_id ?? null,
    amountOut: quote.amountOut,
    gasGram: quote.gasGram,
  };
}

export async function getSwapStatus(routeId: number): Promise<SwapOutcome> {
  return swapOutcome(await getJson(`${COFFEE_API}/v2/route/result?route_id=${routeId}`));
}
