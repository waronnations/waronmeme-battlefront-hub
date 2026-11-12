// War Vault: per-player multi-asset balances, weekly cycle pools, signed claim
// vouchers and TonMap / GRAM holder perks. Server-only.
import { displayTicker } from "@/lib/tokens";
import { Address } from "@ton/core";
import { keyPairFromSeed, sign } from "@ton/crypto";
import { sql } from "@/lib/db/client.server";
import { nextWeeklyBattle } from "@/lib/war-cycle/cycle";
import {
  TON_ASSET,
  VOUCHER_TTL_SEC,
  PACK_FEE_TO_POOL,
  canClaim,
  claimableBalance,
  cycleKey,
  distributeCycle,
  pickWinningFaction,
  type VaultAsset,
} from "./vault";
import { assetIdFor, toUnits, voucherDataCell } from "@/lib/onchain/vault-claim";

let tablesReady: Promise<void> | null = null;

/** Additive tables for the vault; created on first use. */
export function ensureVaultTables(): Promise<void> {
  if (!tablesReady) {
    tablesReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS vault_pools (
          cycle_key      TEXT NOT NULL,
          asset_key      TEXT NOT NULL,
          amount         NUMERIC(38,9) NOT NULL DEFAULT 0,
          distributed_at TIMESTAMPTZ,
          updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (cycle_key, asset_key)
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS vault_ledger (
          id         BIGSERIAL PRIMARY KEY,
          user_id    BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          asset_key  TEXT NOT NULL,
          amount     NUMERIC(38,9) NOT NULL,
          source     TEXT NOT NULL,
          cycle_key  TEXT NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_id, asset_key, source, cycle_key)
        )`;
      await sql`CREATE INDEX IF NOT EXISTS vault_ledger_user_idx ON vault_ledger (user_id, asset_key)`;
      await sql`
        CREATE TABLE IF NOT EXISTS vault_vouchers (
          id          BIGSERIAL PRIMARY KEY,
          user_id     BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          asset_key   TEXT NOT NULL,
          amount      NUMERIC(38,9) NOT NULL,
          nonce       BIGINT UNIQUE NOT NULL,
          deadline    BIGINT NOT NULL,
          beneficiary TEXT NOT NULL,
          signature   TEXT NOT NULL,
          status      TEXT NOT NULL DEFAULT 'issued',
          created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`CREATE INDEX IF NOT EXISTS vault_vouchers_user_idx ON vault_vouchers (user_id, status)`;
      // One open claim per player per asset, enforced by the database so two
      // parallel requests can never both lock the same balance.
      await sql`CREATE UNIQUE INDEX IF NOT EXISTS vault_vouchers_one_open_idx ON vault_vouchers (user_id, asset_key) WHERE status IN ('issued','sent')`;
      await sql`
        CREATE TABLE IF NOT EXISTS vault_assets (
          asset_key  TEXT PRIMARY KEY,
          symbol     TEXT NOT NULL,
          kind       TEXT NOT NULL,
          decimals   INT NOT NULL DEFAULT 9,
          min_claim  NUMERIC(38,9) NOT NULL DEFAULT 0,
          enabled    BOOLEAN NOT NULL DEFAULT TRUE
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS holder_perks (
          user_id       BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          wallet        TEXT NOT NULL,
          tonmap_pixels INT NOT NULL DEFAULT 0,
          gram_balance  NUMERIC(38,9) NOT NULL DEFAULT 0,
          landlord      BOOLEAN NOT NULL DEFAULT FALSE,
          checked_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`
        CREATE TABLE IF NOT EXISTS player_resources (
          user_id    BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          dust       INT NOT NULL DEFAULT 0,
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )`;
      await sql`ALTER TABLE pack_orders ADD COLUMN IF NOT EXISTS pool_funded BOOLEAN NOT NULL DEFAULT FALSE`;
      await sql`
        INSERT INTO vault_assets (asset_key, symbol, kind, decimals, min_claim)
        VALUES ('ton', 'GRAM', 'native', 9, ${TON_ASSET.minClaim})
        ON CONFLICT (asset_key) DO NOTHING`;
      const gram = process.env["GRAM_JETTON_MASTER"];
      if (gram) {
        await sql`
          INSERT INTO vault_assets (asset_key, symbol, kind, decimals, min_claim)
          VALUES (${gram}, 'GRAM', 'jetton', 9, 1)
          ON CONFLICT (asset_key) DO NOTHING`;
      }
    })().catch((e) => {
      tablesReady = null;
      throw e;
    });
  }
  return tablesReady;
}

// ── Config ──────────────────────────────────────────────────────────────
export function vaultAddress(): string | null {
  return process.env["WAR_VAULT_ADDRESS"] ?? null;
}

export function vaultLive(): boolean {
  return Boolean(vaultAddress() && signerHex());
}

/** WAR_VAULT_SIGNER_KEY is the vault's own key; the legacy treasury key is a fallback. */
function signerHex(): string | undefined {
  return process.env["WAR_VAULT_SIGNER_KEY"] || process.env["CLAIM_SIGNER_PRIVATE_KEY"] || undefined;
}

function signerKeys() {
  const hex = signerHex();
  if (!hex) throw new Error("Vault signer is not configured");
  const buf = Buffer.from(hex, "hex");
  if (buf.length === 64) return { publicKey: buf.subarray(32), secretKey: buf };
  if (buf.length === 32) return keyPairFromSeed(buf);
  throw new Error("Vault signer key has the wrong length");
}

export async function listVaultAssets(): Promise<VaultAsset[]> {
  const { rows } = await sql`SELECT asset_key, symbol, kind, decimals, min_claim FROM vault_assets WHERE enabled = TRUE ORDER BY (asset_key = 'ton') DESC, symbol`;
  return rows.map((r) => ({
    key: String(r["asset_key"]),
    symbol: displayTicker(String(r["symbol"])),
    kind: r["kind"] === "native" ? "native" : "jetton",
    decimals: Number(r["decimals"]),
    minClaim: Number(r["min_claim"]),
  }));
}

// ── Reads ───────────────────────────────────────────────────────────────
export type VaultBalance = VaultAsset & { accrued: number; locked: number; claimable: number };

export async function getVault(userId: number) {
  await expireStaleVouchers(userId);
  const assets = await listVaultAssets();
  const acc = await sql`SELECT asset_key, COALESCE(SUM(amount),0)::float8 AS v FROM vault_ledger WHERE user_id = ${userId} GROUP BY asset_key`;
  const lock = await sql`SELECT asset_key, COALESCE(SUM(amount),0)::float8 AS v FROM vault_vouchers WHERE user_id = ${userId} AND status <> 'expired' GROUP BY asset_key`;
  const accMap = new Map(acc.rows.map((r) => [String(r["asset_key"]), Number(r["v"])]));
  const lockMap = new Map(lock.rows.map((r) => [String(r["asset_key"]), Number(r["v"])]));
  // Assets the player earned but which are no longer listed still show up.
  const keys = new Set([...assets.map((a) => a.key), ...accMap.keys()]);
  const balances: VaultBalance[] = [...keys].map((key) => {
    const a = assets.find((x) => x.key === key) ?? { key, symbol: key.slice(0, 6), kind: "jetton" as const, decimals: 9, minClaim: 0 };
    const accrued = accMap.get(key) ?? 0;
    const locked = lockMap.get(key) ?? 0;
    return { ...a, accrued, locked, claimable: claimableBalance(accrued, locked) };
  });
  const history = await sql`
    SELECT 'reward' AS type, asset_key, amount::float8 AS amount, source AS label, created_at FROM vault_ledger WHERE user_id = ${userId}
    UNION ALL
    SELECT 'claim' AS type, asset_key, amount::float8 AS amount, status AS label, created_at FROM vault_vouchers WHERE user_id = ${userId}
    ORDER BY created_at DESC LIMIT 25`;
  const perks = await getPerks(userId);
  return {
    balances,
    history: history.rows.map((r) => ({
      type: String(r["type"]) as "reward" | "claim",
      assetKey: String(r["asset_key"]),
      amount: Number(r["amount"]),
      label: String(r["label"]),
      at: String(r["created_at"]),
    })),
    perks,
    live: vaultLive(),
  };
}

export async function currentPools() {
  const battleAt = nextWeeklyBattle(Date.now());
  const key = cycleKey(battleAt);
  const assets = await listVaultAssets();
  const { rows } = await sql`SELECT asset_key, amount::float8 AS amount FROM vault_pools WHERE cycle_key = ${key}`;
  const map = new Map(rows.map((r) => [String(r["asset_key"]), Number(r["amount"])]));
  return {
    cycleKey: key,
    battleAt,
    pools: assets.map((a) => ({ key: a.key, symbol: a.symbol, amount: map.get(a.key) ?? 0 })),
  };
}

// ── Funding ─────────────────────────────────────────────────────────────
export async function fundPool(assetKey: string, amount: number, key = cycleKey(nextWeeklyBattle(Date.now()))) {
  if (!(amount > 0)) return;
  await sql`
    INSERT INTO vault_pools (cycle_key, asset_key, amount) VALUES (${key}, ${assetKey}, ${amount})
    ON CONFLICT (cycle_key, asset_key) DO UPDATE SET amount = vault_pools.amount + ${amount}, updated_at = NOW()
    WHERE vault_pools.distributed_at IS NULL`;
}

/** Pack purchases feed a small share of their TON value into the pool, once per order. */
export async function fundFromPack(orderId: number) {
  const { rows } = await sql`
    UPDATE pack_orders SET pool_funded = TRUE
    WHERE id = ${orderId} AND status = 'sent' AND pool_funded = FALSE RETURNING price_gram::float8 AS price`;
  const price = Number(rows[0]?.["price"] ?? 0);
  if (price > 0) await fundPool("ton", price * PACK_FEE_TO_POOL);
}

// ── Distribution (scheduled) ───────────────────────────────────────────
export async function distributeDueCycles(now = Date.now()) {
  const current = cycleKey(nextWeeklyBattle(now));
  const { rows: due } = await sql`
    SELECT p.cycle_key, p.asset_key, p.amount::float8 AS amount, COALESCE(a.decimals, 9) AS decimals
    FROM vault_pools p LEFT JOIN vault_assets a ON a.asset_key = p.asset_key
    WHERE p.distributed_at IS NULL AND p.cycle_key < ${current} AND p.amount > 0
    ORDER BY p.cycle_key LIMIT 10`;
  if (due.length === 0) return { distributed: 0 };

  const lb = await sql`
    SELECT u.id AS user_id FROM progress p JOIN users u ON u.id = p.user_id
    WHERE u.is_banned = FALSE AND p.glory > 0 ORDER BY p.glory DESC, u.id LIMIT 100`;
  const factionRows = await sql`
    SELECT u.id AS user_id, p.glory::float8 AS glory, n.faction
    FROM users u JOIN progress p ON p.user_id = u.id JOIN nations n ON n.id = u.nation_id
    WHERE u.is_banned = FALSE AND n.faction IN ('wardog','warcat') AND p.glory > 0`;
  const totals = { wardog: 0, warcat: 0 };
  for (const r of factionRows.rows) totals[r["faction"] as "wardog" | "warcat"] += Number(r["glory"]);
  const winner = pickWinningFaction(totals);
  const winningMembers = factionRows.rows
    .filter((r) => r["faction"] === winner)
    .map((r) => ({ userId: Number(r["user_id"]), glory: Number(r["glory"]) }));
  const conv = await sql`
    SELECT user_id, SUM(amount * LEAST(1, EXTRACT(EPOCH FROM (NOW() - held_since)) / 2592000.0))::float8 AS w
    FROM conviction_positions GROUP BY user_id`;
  const conviction = new Map(conv.rows.map((r) => [Number(r["user_id"]), Number(r["w"])]));
  const land = await sql`SELECT user_id FROM holder_perks WHERE landlord = TRUE`;
  const landlords = new Set(land.rows.map((r) => Number(r["user_id"])));

  let paidRows = 0;
  for (const pool of due) {
    const key = String(pool["cycle_key"]);
    const asset = String(pool["asset_key"]);
    const claimed = await sql`
      UPDATE vault_pools SET distributed_at = NOW()
      WHERE cycle_key = ${key} AND asset_key = ${asset} AND distributed_at IS NULL RETURNING amount`;
    if (claimed.rows.length === 0) continue; // another tick got it
    const alloc = distributeCycle({
      pool: Number(pool["amount"]),
      decimals: Number(pool["decimals"]),
      leaderboard: lb.rows.map((r) => ({ userId: Number(r["user_id"]) })),
      winningMembers,
      conviction,
      landlords,
    });
    for (const [userId, amount] of alloc) {
      await sql`
        INSERT INTO vault_ledger (user_id, asset_key, amount, source, cycle_key)
        VALUES (${userId}, ${asset}, ${amount}, 'cycle', ${key})
        ON CONFLICT (user_id, asset_key, source, cycle_key) DO NOTHING`;
      paidRows += 1;
    }
  }
  return { distributed: due.length, winner, paidRows };
}

// ── Claims ──────────────────────────────────────────────────────────────
export async function issueVoucher(userId: number, assetKey: string, wallet: string) {
  const vault = vaultAddress();
  if (!vault || !vaultLive()) throw new Error("On-chain claims open once the War Vault contract is deployed");
  const { balances } = await getVault(userId);
  const bal = balances.find((b) => b.key === assetKey);
  if (!bal) throw new Error("Unknown asset");
  const check = canClaim(bal.claimable, bal);
  if (!check.ok) throw new Error(check.reason);
  const pending = await sql`SELECT 1 FROM vault_vouchers WHERE user_id = ${userId} AND asset_key = ${assetKey} AND status IN ('issued','sent') LIMIT 1`;
  if (pending.rows.length > 0) throw new Error("You already have a claim in progress for this asset");

  const amount = Math.floor(bal.claimable * 10 ** Math.min(9, bal.decimals)) / 10 ** Math.min(9, bal.decimals);
  const units = toUnits(amount, bal.decimals);
  const nonce = BigInt(Date.now()) * 1000n + BigInt(Math.floor(Math.random() * 1000));
  const deadline = Math.floor(Date.now() / 1000) + VOUCHER_TTL_SEC;
  const beneficiary = Address.parse(wallet).toString({ bounceable: false });
  const assetId = assetIdFor(assetKey);
  const hash = voucherDataCell({ assetId, amount: units, beneficiary, nonce, deadline, vault }).hash();
  const signatureHex = Buffer.from(sign(hash, signerKeys().secretKey)).toString("hex");
  try {
    await sql`
      INSERT INTO vault_vouchers (user_id, asset_key, amount, nonce, deadline, beneficiary, signature)
      VALUES (${userId}, ${assetKey}, ${amount}, ${nonce.toString()}, ${deadline}, ${beneficiary}, ${signatureHex})`;
  } catch (e) {
    if (/duplicate key|unique/i.test(e instanceof Error ? e.message : "")) {
      throw new Error("You already have a claim in progress for this asset");
    }
    throw e;
  }
  return {
    vault,
    assetId: assetId.toString(),
    amount: units.toString(),
    displayAmount: amount,
    beneficiary,
    nonce: nonce.toString(),
    deadline,
    signatureHex,
  };
}

async function nonceUsedOnChain(nonce: string): Promise<boolean | null> {
  const vault = vaultAddress();
  if (!vault) return null;
  const net = process.env["TON_NETWORK"] === "testnet" ? "testnet." : "";
  const key = process.env["TONCENTER_API_KEY"];
  try {
    const res = await fetch(`https://${net}toncenter.com/api/v2/runGetMethod`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(key ? { "X-API-Key": key } : {}) },
      body: JSON.stringify({ address: vault, method: "nonceUsed", stack: [["num", `0x${BigInt(nonce).toString(16)}`]] }),
      signal: AbortSignal.timeout(8000),
    });
    const json = (await res.json()) as { ok?: boolean; result?: { exit_code?: number; stack?: [string, string][] } };
    if (!json.ok || json.result?.exit_code !== 0) return null;
    const v = json.result.stack?.[0]?.[1];
    return v != null && BigInt(v) !== 0n;
  } catch {
    return null;
  }
}

/**
 * Past-deadline vouchers are either paid (nonce used on chain) or released
 * back to the balance. If the chain can't be read, the voucher stays locked
 * so a reward can never be paid twice.
 */
export async function expireStaleVouchers(userId?: number) {
  const nowSec = Math.floor(Date.now() / 1000);
  const { rows } = userId
    ? await sql`SELECT id, nonce FROM vault_vouchers WHERE user_id = ${userId} AND status = 'issued' AND deadline < ${nowSec} LIMIT 10`
    : await sql`SELECT id, nonce FROM vault_vouchers WHERE status = 'issued' AND deadline < ${nowSec} LIMIT 50`;
  for (const r of rows) {
    const used = await nonceUsedOnChain(String(r["nonce"]));
    if (used === true) await sql`UPDATE vault_vouchers SET status = 'paid' WHERE id = ${r["id"]}`;
    else if (used === false) await sql`UPDATE vault_vouchers SET status = 'expired' WHERE id = ${r["id"]}`;
  }
  return { checked: rows.length };
}

export async function markVoucherSent(userId: number, nonce: string) {
  await sql`UPDATE vault_vouchers SET status = 'sent' WHERE user_id = ${userId} AND nonce = ${nonce} AND status = 'issued'`;
}

// ── Holder perks (TonMap pixels, GRAM) ─────────────────────────────────
export async function getPerks(userId: number) {
  const { rows } = await sql`SELECT wallet, tonmap_pixels, gram_balance::float8 AS gram, landlord, checked_at FROM holder_perks WHERE user_id = ${userId}`;
  const r = rows[0];
  if (!r) return null;
  return {
    wallet: String(r["wallet"]),
    pixels: Number(r["tonmap_pixels"]),
    gram: Number(r["gram"]),
    landlord: Boolean(r["landlord"]),
    checkedAt: String(r["checked_at"]),
  };
}

export function perksConfigured() {
  return { tonmap: Boolean(process.env["TONMAP_COLLECTION_ADDRESS"]), gram: Boolean(process.env["GRAM_JETTON_MASTER"]) };
}

async function tonapi<T>(path: string): Promise<T | null> {
  const key = process.env["TONAPI_KEY"];
  const res = await fetch(`https://tonapi.io/v2${path}`, {
    headers: { Accept: "application/json", ...(key ? { Authorization: `Bearer ${key}` } : {}) },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Wallet lookup failed (${res.status})`);
  return (await res.json()) as T;
}

export async function refreshPerks(userId: number, wallet: string) {
  const cached = await getPerks(userId);
  if (cached && cached.wallet === wallet && Date.now() - Date.parse(cached.checkedAt) < 60 * 60_000) return cached;
  const collection = process.env["TONMAP_COLLECTION_ADDRESS"];
  const gramMaster = process.env["GRAM_JETTON_MASTER"];
  let pixels = 0;
  let gram = 0;
  if (collection) {
    const nfts = await tonapi<{ nft_items?: unknown[] }>(`/accounts/${encodeURIComponent(wallet)}/nfts?collection=${encodeURIComponent(collection)}&limit=1000`);
    pixels = nfts?.nft_items?.length ?? 0;
  }
  if (gramMaster) {
    const j = await tonapi<{ balance?: string; jetton?: { decimals?: number } }>(`/accounts/${encodeURIComponent(wallet)}/jettons/${encodeURIComponent(gramMaster)}`);
    if (j?.balance) gram = Number(j.balance) / 10 ** Number(j.jetton?.decimals ?? 9);
  }
  const landlord = pixels > 0;
  await sql`
    INSERT INTO holder_perks (user_id, wallet, tonmap_pixels, gram_balance, landlord, checked_at)
    VALUES (${userId}, ${wallet}, ${pixels}, ${gram}, ${landlord}, NOW())
    ON CONFLICT (user_id) DO UPDATE SET wallet = EXCLUDED.wallet, tonmap_pixels = EXCLUDED.tonmap_pixels,
      gram_balance = EXCLUDED.gram_balance, landlord = EXCLUDED.landlord, checked_at = NOW()`;
  return getPerks(userId);
}
