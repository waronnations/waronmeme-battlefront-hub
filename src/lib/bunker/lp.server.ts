// Bunker LP: live STON.fi pool metrics, in-game add-liquidity transactions and Doomsday pledges. Server-only.
import { Address } from "@ton/core";
import { sql } from "@/lib/db/client.server";
import { getMarketCoins } from "@/lib/market/market.server";
import { WARCAT_CA, WARDOG_CA } from "@/lib/tokens";
import {
  BUNKER_LP_RULES,
  TON_ADDRESS,
  bunkerPool,
  checkLpMessages,
  coinLpMetrics,
  pledgeStatus,
  poolFromApi,
  positionFees,
  quoteProvide,
  type LpBoardRow,
  type LpMessage,
  type PledgeStatus,
  type PoolStat,
  type StonPoolRaw,
} from "./lp";

const STON = "https://api.ston.fi/v1";
const POOL_TTL_MS = 5 * 60_000;
const BOARD_TTL_MS = 5 * 60_000;
const TIMEOUT_MS = 8_000;

const poolCache = new Map<string, { at: number; pools: PoolStat[] }>();
const routerCache = new Map<string, RouterInfo>();
let boardCache: { at: number; data: LpBoard } | null = null;

type RouterInfo = { address: string; majorVersion: number; minorVersion: number; routerType?: string; ptonMaster: string };

async function getJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS), headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

/** Every live STON.fi (v1 + v2) pool pairing the coin with GRAM. */
export async function coinPools(master: string): Promise<PoolStat[]> {
  const hit = poolCache.get(master);
  if (hit && Date.now() - hit.at < POOL_TTL_MS) return hit.pools;
  const j = await getJson<{ pool_list?: StonPoolRaw[] }>(`${STON}/pools/by_market/${TON_ADDRESS}/${encodeURIComponent(master)}?dex_v2=true`);
  if (!j) {
    if (hit) return hit.pools;
    throw new Error("pool_data_unavailable");
  }
  const pools = (j.pool_list ?? []).map((p) => poolFromApi(p, master)).filter((p): p is PoolStat => p !== null);
  if (poolCache.size > 300) poolCache.delete(poolCache.keys().next().value as string);
  poolCache.set(master, { at: Date.now(), pools });
  return pools;
}

async function routerInfo(address: string): Promise<RouterInfo> {
  const hit = routerCache.get(address);
  if (hit) return hit;
  const j = await getJson<{ router?: { address: string; major_version: number; minor_version: number; router_type?: string; pton_master_address: string } }>(`${STON}/routers/${encodeURIComponent(address)}`);
  if (!j?.router) throw new Error("router_unavailable");
  const info = { address: j.router.address, majorVersion: j.router.major_version, minorVersion: j.router.minor_version, routerType: j.router.router_type, ptonMaster: j.router.pton_master_address };
  routerCache.set(address, info);
  return info;
}

// ── Storage ───────────────────────────────────────────────────────────
let ready: Promise<void> | null = null;
export function ensureBunkerTables(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS bunker_lp_pledges (
          id            BIGSERIAL PRIMARY KEY,
          user_id       BIGINT NOT NULL,
          wallet        TEXT NOT NULL,
          coin_master   TEXT NOT NULL,
          coin_symbol   TEXT NOT NULL DEFAULT '',
          pool_address  TEXT NOT NULL,
          lp_units      NUMERIC(40,0) NOT NULL,
          lp_usd        NUMERIC(20,2) NOT NULL DEFAULT 0,
          status        TEXT NOT NULL DEFAULT 'holding',
          pledged_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          until_at      TIMESTAMPTZ NOT NULL,
          checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_units    NUMERIC(40,0),
          broken_at     TIMESTAMPTZ,
          UNIQUE (user_id, pool_address)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS bunker_lp_pledges_coin_idx ON bunker_lp_pledges (coin_master, status)`;
      await sql`CREATE INDEX IF NOT EXISTS bunker_lp_pledges_checked_idx ON bunker_lp_pledges (status, checked_at)`;
    })().catch((e) => {
      ready = null;
      throw e;
    });
  }
  return ready;
}

/** Holding pledges per coin: total USD at pledge time and distinct pledgers. */
export async function bunkerTotals(): Promise<Map<string, { usd: number; pledgers: number }>> {
  await ensureBunkerTables();
  const { rows } = await sql`
    SELECT coin_master, COALESCE(SUM(lp_usd), 0)::float8 AS usd, COUNT(DISTINCT user_id)::int AS pledgers
    FROM bunker_lp_pledges WHERE status = 'holding' GROUP BY coin_master`;
  return new Map(rows.map((r) => [String(r["coin_master"]), { usd: Number(r["usd"]), pledgers: Number(r["pledgers"]) }]));
}

// ── Chain reads ───────────────────────────────────────────────────────
function tonapiHeaders(): HeadersInit {
  const key = process.env.TONAPI_KEY;
  return key ? { Accept: "application/json", Authorization: `Bearer ${key}` } : { Accept: "application/json" };
}

/** Jetton units of `minter` held by `owner`. A pool contract is its own LP jetton master. */
export async function readLpBalance(owner: string, minter: string): Promise<bigint> {
  const o = Address.parse(owner).toRawString();
  const p = Address.parse(minter).toRawString();
  const res = await fetch(`https://tonapi.io/v2/accounts/${encodeURIComponent(o)}/jettons/${encodeURIComponent(p)}`, { headers: tonapiHeaders(), signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (res.status === 404) return 0n;
  if (!res.ok) throw new Error(`lp_balance_unavailable_${res.status}`);
  const j = (await res.json()) as { balance?: string };
  return BigInt(j.balance ?? "0");
}

// ── Board ─────────────────────────────────────────────────────────────
export type { LpBoardRow };
export type LpBoard = { rows: LpBoardRow[]; updatedAt: number; until: number };

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]!);
      }
    }),
  );
  return out;
}

export async function lpBoard(opts: { withBunker: boolean }): Promise<LpBoard> {
  if (boardCache && Date.now() - boardCache.at < BOARD_TTL_MS) return boardCache.data;
  const { boardByTier } = await import("@/lib/war-cycle/cycle.server");
  const board = await boardByTier();
  const picked = new Map<string, { coin: (typeof board.recruit)[number]; tier: LpBoardRow["tier"] }>();
  for (const t of ["admiral", "captain", "recruit"] as const) for (const c of board[t].slice(0, 10)) picked.set(c.master, { coin: c, tier: t });
  const all = await getMarketCoins().catch(() => []);
  for (const m of [WARDOG_CA, WARCAT_CA]) {
    const c = all.find((x) => x.master === m);
    if (c && !picked.has(m)) picked.set(m, { coin: c, tier: "faction" });
  }
  const totals = opts.withBunker ? await bunkerTotals().catch(() => new Map()) : new Map();
  const list = [...picked.values()];
  const rows = await mapLimit(list, 6, async ({ coin, tier }) => {
    const pools = await coinPools(coin.master).catch(() => [] as PoolStat[]);
    const metrics = coinLpMetrics(pools, totals.get(coin.master) ?? { usd: 0, pledgers: 0 });
    return { master: coin.master, symbol: coin.symbol, image: coin.image, priceUsd: coin.priceUsd, tier, metrics, canProvide: metrics.bunkerPool !== null };
  });
  rows.sort((a, b) => b.metrics.tvlUsd - a.metrics.tvlUsd);
  const data = { rows, updatedAt: Date.now(), until: BUNKER_LP_RULES.until };
  boardCache = { at: Date.now(), data };
  return data;
}

// ── Add liquidity ─────────────────────────────────────────────────────
export type ProvideLpPlan = {
  pool: string;
  symbol: string;
  tonAmount: number;
  coinUnits: string;
  coinDecimals: number;
  coinAmount: number;
  expectedLp: string;
  minLpOut: string;
  poolShare: number;
  feesPerDayUsd: number;
  /** Coin units the wallet holds now (null when it couldn't be read). */
  coinBalanceUnits: string | null;
  request: { validUntil: number; messages: LpMessage[] };
};

async function coinDecimals(master: string): Promise<number> {
  const j = await getJson<{ asset?: { decimals?: number } }>(`${STON}/assets/${encodeURIComponent(master)}`);
  const d = Number(j?.asset?.decimals ?? 9);
  return Number.isInteger(d) && d >= 0 && d <= 18 ? d : 9;
}

const walletCache = new Map<string, string>();

/** Jetton wallet address of `owner` for `minter`, resolved by STON.fi's API (deterministic, cached). */
async function jettonWalletOf(minter: string, owner: string): Promise<Address> {
  const key = `${minter}:${owner}`;
  const hit = walletCache.get(key);
  if (hit) return Address.parse(hit);
  const j = await getJson<{ address?: string }>(`${STON}/jetton/${encodeURIComponent(minter)}/address?owner_address=${encodeURIComponent(owner)}`);
  if (!j?.address) throw new Error("jetton_wallet_unavailable");
  if (walletCache.size > 2000) walletCache.clear();
  walletCache.set(key, j.address);
  return Address.parse(j.address);
}

/**
 * Minimal contract provider for the STON.fi SDK: building add-liquidity messages only needs
 * `get_wallet_address`, which we answer from the STON.fi API instead of a rate-limited RPC.
 */
async function sdkOpener() {
  const { openContract, beginCell, TupleReader } = await import("@ton/core");
  type Opened = Parameters<typeof openContract>[1];
  const factory: Opened = ({ address }) =>
    ({
      async get(name: string, args: Array<{ type: string; cell?: import("@ton/core").Cell }>) {
        if (name !== "get_wallet_address" || !args[0]?.cell) throw new Error(`unsupported_get_${name}`);
        const owner = args[0].cell.beginParse().loadAddress();
        const wallet = await jettonWalletOf(address.toString(), owner.toString());
        return { stack: new TupleReader([{ type: "slice", cell: beginCell().storeAddress(wallet).endCell() }]) };
      },
      open: (c: never) => openContract(c, factory),
      getState: () => Promise.reject(new Error("unsupported")),
      external: () => Promise.reject(new Error("unsupported")),
      internal: () => Promise.reject(new Error("unsupported")),
      getTransactions: () => Promise.reject(new Error("unsupported")),
    }) as never;
  return <T extends object>(c: T) => openContract(c as never, factory) as unknown as T;
}

export async function buildProvideLiquidity(input: { master: string; tonAmount: number; wallet: string }): Promise<ProvideLpPlan> {
  const { tonAmount } = input;
  if (!(tonAmount >= BUNKER_LP_RULES.minTon && tonAmount <= BUNKER_LP_RULES.maxTon)) throw new Error(`Deposit between ${BUNKER_LP_RULES.minTon} and ${BUNKER_LP_RULES.maxTon} GRAM`);
  if (Date.now() >= BUNKER_LP_RULES.until) throw new Error("Doomsday has struck — the bunker is sealed");
  const wallet = Address.parse(input.wallet).toString({ bounceable: false, urlSafe: true });

  const coin = (await getMarketCoins()).find((c) => c.master === input.master);
  if (!coin) throw new Error("Coin not on the board");
  const { jettonSafety } = await import("@/lib/dex/routes.server");
  const safety = await jettonSafety(coin.master);
  if (!safety.routable) throw new Error(`${coin.symbol} is ${safety.label.toLowerCase()} — liquidity disabled`);

  const pool = bunkerPool(await coinPools(coin.master));
  if (!pool) throw new Error(`${coin.symbol} has no STON.fi v2 GRAM pool to supply`);
  const tonNano = BigInt(Math.round(tonAmount * 1e9));
  const q = quoteProvide(pool, tonNano);
  const decimals = await coinDecimals(coin.master);

  const info = await routerInfo(pool.router);
  if (info.majorVersion < 2) throw new Error("router_unsupported");
  const { routerFactory, dexFactory } = await import("@ston-fi/sdk");
  const open = await sdkOpener();
  const routerSpec = { address: info.address, majorVersion: info.majorVersion, minorVersion: info.minorVersion, routerType: info.routerType as never };
  const router = open(routerFactory(routerSpec) as never) as unknown as {
    getProvideLiquidityTonTxParams: (p: Record<string, unknown>) => Promise<{ to: Address; value: bigint; body?: { toBoc(): Buffer } | null }>;
    getProvideLiquidityJettonTxParams: (p: Record<string, unknown>) => Promise<{ to: Address; value: bigint; body?: { toBoc(): Buffer } | null }>;
  };
  const dex = dexFactory(routerSpec) as unknown as { pTON: { create(addr: string): { address: Address } } };
  const proxyTon = dex.pTON.create(info.ptonMaster);
  const queryId = BigInt(Date.now());

  const tonLeg = await router.getProvideLiquidityTonTxParams({
    userWalletAddress: wallet,
    proxyTon,
    otherTokenAddress: coin.master,
    sendAmount: tonNano,
    minLpOut: q.minLpOut,
    queryId,
  });
  const coinLeg = await router.getProvideLiquidityJettonTxParams({
    userWalletAddress: wallet,
    sendTokenAddress: coin.master,
    otherTokenAddress: proxyTon.address,
    sendAmount: q.coinUnits,
    minLpOut: q.minLpOut,
    queryId,
  });
  const messages: LpMessage[] = [tonLeg, coinLeg].map((p) => ({ address: p.to.toString(), amount: p.value.toString(), payload: p.body ? p.body.toBoc().toString("base64") : undefined }));
  checkLpMessages(messages, tonNano);
  const fees = positionFees(q.expectedLp, pool);
  const balance = await readLpBalance(wallet, coin.master).catch(() => null);
  return {
    pool: pool.address,
    symbol: coin.symbol,
    tonAmount,
    coinUnits: q.coinUnits.toString(),
    coinDecimals: decimals,
    coinAmount: Number(q.coinUnits) / 10 ** decimals,
    expectedLp: q.expectedLp.toString(),
    minLpOut: q.minLpOut.toString(),
    poolShare: fees.share,
    feesPerDayUsd: fees.feesPerDayUsd,
    coinBalanceUnits: balance === null ? null : balance.toString(),
    request: { validUntil: Math.floor(Date.now() / 1000) + 300, messages },
  };
}

// ── Pledges ───────────────────────────────────────────────────────────
export type MyPledge = {
  coinMaster: string;
  symbol: string;
  pool: string;
  lpUnits: string;
  lpUsd: number;
  valueUsd: number;
  poolShare: number;
  feesPerDayUsd: number;
  status: PledgeStatus;
  pledgedAt: string;
  until: string;
};

async function userWallet(userId: number): Promise<string> {
  const { rows } = await sql`SELECT wallet_address FROM users WHERE id = ${userId}`;
  const w = rows[0]?.["wallet_address"] as string | null | undefined;
  if (!w) throw new Error("Link your wallet first (it signs a one-time check)");
  return w;
}

async function apexMaster(): Promise<string | null> {
  if (Date.now() < BUNKER_LP_RULES.until) return null;
  const { apocalypseStandings } = await import("@/lib/war-cycle/cycle.server");
  return (await apocalypseStandings())[0]?.master ?? null;
}

async function recheck(row: Record<string, unknown>, apex: string | null): Promise<PledgeStatus> {
  const pledged = BigInt(String(row["lp_units"]));
  const cur = Date.now() < BUNKER_LP_RULES.until ? await readLpBalance(String(row["wallet"]), String(row["pool_address"])) : null;
  const next = pledgeStatus({ pledgedUnits: pledged, currentUnits: cur, status: String(row["status"]) as PledgeStatus, now: Date.now(), coinMaster: String(row["coin_master"]), apexMaster: apex });
  await sql`
    UPDATE bunker_lp_pledges SET status = ${next}, checked_at = NOW(), last_units = ${cur === null ? null : cur.toString()},
      broken_at = CASE WHEN ${next} = 'broken' AND broken_at IS NULL THEN NOW() ELSE broken_at END
    WHERE id = ${row["id"]}`;
  return next;
}

/** Re-reads the oldest-checked holding pledges so withdrawn LP stops counting. */
export async function recheckStalePledges(limit = 5): Promise<number> {
  await ensureBunkerTables();
  const cutoff = new Date(Date.now() - BUNKER_LP_RULES.recheckMs);
  const { rows } = await sql`SELECT * FROM bunker_lp_pledges WHERE status = 'holding' AND checked_at < ${cutoff} ORDER BY checked_at ASC LIMIT ${limit}`;
  const apex = await apexMaster().catch(() => null);
  let n = 0;
  for (const r of rows) {
    try {
      await recheck(r, apex);
      n++;
    } catch (e) {
      console.error("[bunker] recheck failed", e);
    }
  }
  return n;
}

export async function myPledges(userId: number): Promise<MyPledge[]> {
  await ensureBunkerTables();
  const { rows } = await sql`SELECT * FROM bunker_lp_pledges WHERE user_id = ${userId} ORDER BY pledged_at DESC LIMIT 50`;
  const apex = await apexMaster().catch(() => null);
  const out: MyPledge[] = [];
  for (const r of rows) {
    let status = String(r["status"]) as PledgeStatus;
    const stale = Date.now() - new Date(String(r["checked_at"])).getTime() > BUNKER_LP_RULES.recheckMs / 6;
    if (status === "holding" && stale) status = await recheck(r, apex).catch(() => status);
    const pool = (await coinPools(String(r["coin_master"])).catch(() => [])).find((p) => p.address === r["pool_address"]);
    const units = BigInt(String(r["lp_units"]));
    const f = pool ? positionFees(units, pool) : { share: 0, valueUsd: Number(r["lp_usd"]), feesPerDayUsd: 0 };
    out.push({
      coinMaster: String(r["coin_master"]),
      symbol: String(r["coin_symbol"]),
      pool: String(r["pool_address"]),
      lpUnits: units.toString(),
      lpUsd: Number(r["lp_usd"]),
      valueUsd: f.valueUsd,
      poolShare: f.share,
      feesPerDayUsd: f.feesPerDayUsd,
      status,
      pledgedAt: String(r["pledged_at"]),
      until: String(r["until_at"]),
    });
  }
  return out;
}

/** Locks the wallet's current LP in the coin's bunker pool until Doomsday. */
export async function pledgeLp(userId: number, master: string): Promise<MyPledge[]> {
  if (Date.now() >= BUNKER_LP_RULES.until) throw new Error("Doomsday has struck — the bunker is sealed");
  await ensureBunkerTables();
  const wallet = await userWallet(userId);
  const coin = (await getMarketCoins()).find((c) => c.master === master);
  if (!coin) throw new Error("Coin not on the board");
  const pool = bunkerPool(await coinPools(master));
  if (!pool) throw new Error(`${coin.symbol} has no STON.fi v2 GRAM pool`);
  const units = await readLpBalance(wallet, pool.address);
  if (units <= 0n) throw new Error(`No ${coin.symbol} LP in your linked wallet yet — add liquidity first (it can take a minute to arrive)`);
  const { valueUsd } = positionFees(units, pool);
  if (valueUsd < BUNKER_LP_RULES.minPledgeUsd) throw new Error(`Pledge at least $${BUNKER_LP_RULES.minPledgeUsd} of LP`);
  const until = new Date(BUNKER_LP_RULES.until);
  await sql`
    INSERT INTO bunker_lp_pledges (user_id, wallet, coin_master, coin_symbol, pool_address, lp_units, lp_usd, status, until_at, last_units)
    VALUES (${userId}, ${wallet}, ${master}, ${coin.symbol}, ${pool.address}, ${units.toString()}, ${valueUsd.toFixed(2)}, 'holding', ${until}, ${units.toString()})
    ON CONFLICT (user_id, pool_address) DO UPDATE SET
      wallet = EXCLUDED.wallet, lp_units = EXCLUDED.lp_units, lp_usd = EXCLUDED.lp_usd, status = 'holding',
      pledged_at = CASE WHEN bunker_lp_pledges.status = 'holding' THEN bunker_lp_pledges.pledged_at ELSE NOW() END,
      checked_at = NOW(), last_units = EXCLUDED.last_units, broken_at = NULL`;
  boardCache = null;
  return myPledges(userId);
}

/** Live LP held by the linked wallet in the coin's bunker pool (for the pledge button). */
export async function walletLp(userId: number, master: string) {
  const wallet = await userWallet(userId);
  const pool = bunkerPool(await coinPools(master));
  if (!pool) return { pool: null, units: "0", valueUsd: 0 };
  const units = await readLpBalance(wallet, pool.address);
  return { pool: pool.address, units: units.toString(), valueUsd: positionFees(units, pool).valueUsd };
}
