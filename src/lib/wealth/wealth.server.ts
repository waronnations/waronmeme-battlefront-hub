import { sql } from "@/lib/db/client.server";
import { getWalletHoldings } from "@/lib/memewar/tonapi.server";
import { assignNationLeaders, rankForWealth, type WealthEntry } from "./wealth";

/** In-game token USD value is not market-priced yet; counted at 0 until listed. */
const INGAME_USD_PER_TOKEN = 0;

export async function snapshotWealth(limit = 100) {
  const { rows } = await sql`
    SELECT u.id, u.wallet_address, COALESCE(p.wardog_tokens,0) + COALESCE(p.warcat_tokens,0) AS tokens
    FROM users u LEFT JOIN progress p ON p.user_id = u.id
    WHERE u.wallet_address IS NOT NULL AND u.is_banned = FALSE
      AND NOT EXISTS (SELECT 1 FROM wealth_snapshots w WHERE w.user_id = u.id AND w.created_at > NOW() - INTERVAL '15 minutes')
    LIMIT ${limit}`;
  let n = 0;
  for (const r of rows) {
    try {
      const holdings = await getWalletHoldings(String(r["wallet_address"]));
      const walletUsd = holdings.reduce((s, h) => s + (h.usd || 0), 0);
      const ingameUsd = Number(r["tokens"]) * INGAME_USD_PER_TOKEN;
      await sql`INSERT INTO wealth_snapshots (user_id, wallet_usd, ingame_usd, total_usd) VALUES (${r["id"]}, ${walletUsd}, ${ingameUsd}, ${walletUsd + ingameUsd})`;
      n++;
    } catch (e) {
      console.error("wealth snapshot failed", r["id"], e);
    }
  }
  return { snapshotted: n };
}

async function entries(): Promise<WealthEntry[]> {
  const { rows } = await sql`
    SELECT u.id, u.nation_id, u.wealth_flagged,
      AVG(w.total_usd) FILTER (WHERE w.created_at > NOW() - INTERVAL '24 hours') AS avg24,
      EXTRACT(EPOCH FROM (NOW() - MIN(w.created_at))) / 3600 AS hours
    FROM users u JOIN wealth_snapshots w ON w.user_id = u.id
    GROUP BY u.id`;
  return rows.map((r) => ({
    userId: Number(r["id"]),
    nationId: r["nation_id"] == null ? null : Number(r["nation_id"]),
    avgUsd24h: Number(r["avg24"] ?? 0),
    hoursTracked: Number(r["hours"] ?? 0),
    flagged: Boolean(r["wealth_flagged"]),
  }));
}

/** Applies richest-player leadership to nations (reuses nations.leader_id if present). */
export async function applyWealthLeaders() {
  const leaders = assignNationLeaders(await entries());
  for (const [nationId, userId] of leaders) {
    await sql`UPDATE nations SET leader_id = ${userId} WHERE id = ${nationId} AND leader_id IS DISTINCT FROM ${userId}`;
  }
  return { nations: leaders.size };
}

export async function wealthLeaderboard(nationId: number | null, limit = 50) {
  const { rows } = await sql`
    SELECT DISTINCT ON (w.user_id) w.user_id, w.total_usd, u.username, u.first_name, u.nation_id
    FROM wealth_snapshots w JOIN users u ON u.id = w.user_id
    WHERE (${nationId}::bigint IS NULL OR u.nation_id = ${nationId}) AND u.wealth_flagged = FALSE
    ORDER BY w.user_id, w.created_at DESC`;
  return rows
    .map((r) => ({
      userId: Number(r["user_id"]),
      name: String(r["username"] ?? r["first_name"] ?? "Commander"),
      totalUsd: Number(r["total_usd"]),
      rank: rankForWealth(Number(r["total_usd"])).rank,
    }))
    .sort((a, b) => b.totalUsd - a.totalUsd)
    .slice(0, limit);
}

export async function myWealth(userId: number) {
  const { rows } = await sql`SELECT total_usd FROM wealth_snapshots WHERE user_id = ${userId} ORDER BY created_at DESC LIMIT 1`;
  const usd = Number(rows[0]?.["total_usd"] ?? 0);
  return { usd, tracked: Boolean(rows[0]), ...rankForWealth(usd) };
}
