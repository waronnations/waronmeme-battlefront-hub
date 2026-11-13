/**
 * War On Nations — Neon Postgres client (server-only).
 * Low-level tagged-template `sql` helper. Queries go through the Lovable
 * connector gateway (NEON_API_KEY); the connection string never lives in code.
 * Falls back to a direct DATABASE_URL via @neondatabase/serverless if set, and
 * otherwise runs on the project's Lovable Cloud database (schema `game`) through
 * the service-role-only `game_exec_sql` function.
 */

import { neon } from "@neondatabase/serverless";
import { inlineSql } from "./sql-literal";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/neon/sql";

function directUrl(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL_UNPOOLED
  );
}

function hasGateway(): boolean {
  return Boolean(process.env.NEON_API_KEY && process.env.LOVABLE_API_KEY);
}

function hasCloud(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasDatabase(): boolean {
  return hasGateway() || Boolean(directUrl()) || hasCloud();
}

type CompatResult = { rows: Record<string, unknown>[]; rowCount: number };

/** Postgres text timestamps -> ISO 8601 so `new Date()` parses them reliably. */
function toIso(v: unknown, withZone: boolean): unknown {
  if (typeof v !== "string") return v;
  let s = v.replace(" ", "T");
  if (withZone) s = s.replace(/([+-]\d{2})$/, "$1:00");
  else s += "Z";
  return s;
}

function normalizeParam(v: unknown): unknown {
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "bigint") return v.toString();
  return v;
}

async function gatewaySql(text: string, params: unknown[]): Promise<CompatResult> {
  const res = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": process.env.NEON_API_KEY as string,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: text, params: params.map(normalizeParam) }),
  });
  const body = await res.text();
  let json: any = {};
  try {
    json = JSON.parse(body);
  } catch {
    /* non-JSON */
  }
  if (!res.ok) {
    const err = new Error(
      `Neon ${res.status}${json?.code ? ` ${json.code}` : ""}: ${json?.message ?? body.slice(0, 300)}`,
    );
    Object.assign(err, { status: res.status, code: json?.code });
    throw err;
  }
  const fields: { name: string; dataTypeID: number }[] = json.fields ?? [];
  const tsCols = fields.filter((f) => f.dataTypeID === 1184 || f.dataTypeID === 1114);
  const rows: Record<string, unknown>[] = json.rows ?? [];
  if (tsCols.length) {
    for (const r of rows) for (const f of tsCols) r[f.name] = toIso(r[f.name], f.dataTypeID === 1184);
  }
  return { rows, rowCount: json.rowCount ?? rows.length };
}

export async function sql(
  strings: TemplateStringsArray,
  ...values: unknown[]
): Promise<CompatResult> {
  if (hasGateway()) {
    let text = strings[0];
    for (let i = 1; i < strings.length; i++) text += `$${i}` + strings[i];
    return gatewaySql(text, values);
  }
  const url = directUrl();
  if (!url) {
    if (hasCloud()) return cloudQuery(inlineSql(strings, values));
    throw new Error("Database not configured");
  }
  const rows = (await neon(url)(strings, ...values)) as Record<string, unknown>[];
  return { rows: rows ?? [], rowCount: rows?.length ?? 0 };
}

async function cloudSql(text: string): Promise<CompatResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data, error } = await supabaseAdmin.rpc("game_exec_sql", { q: text });
  if (error) {
    const err = new Error(`DB${error.code ? ` ${error.code}` : ""}: ${error.message}`);
    Object.assign(err, { code: error.code });
    throw err;
  }
  const out = (data ?? {}) as { rows?: Record<string, unknown>[]; rowCount?: number };
  const rows = out.rows ?? [];
  return { rows, rowCount: out.rowCount ?? rows.length };
}

// Idempotent schema statements (CREATE … IF NOT EXISTS, ALTER … ADD COLUMN IF NOT EXISTS …)
// are recorded once applied, so a cold worker skips the whole bootstrap with one read.
const IDEMPOTENT_DDL = /^\s*(CREATE|ALTER|DROP|COMMENT)\b/i;
let appliedDdl: Promise<Set<string>> | null = null;

function ddlHash(text: string): string {
  const norm = text.replace(/\s+/g, " ").trim();
  let h1 = 0xdeadbeef ^ norm.length;
  let h2 = 0x41c6ce57 ^ norm.length;
  for (let i = 0; i < norm.length; i++) {
    const c = norm.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 2654435761);
    h2 = Math.imul(h2 ^ c, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (h2 >>> 0).toString(16).padStart(8, "0") + (h1 >>> 0).toString(16).padStart(8, "0");
}

function loadApplied(): Promise<Set<string>> {
  if (!appliedDdl) {
    appliedDdl = (async () => {
      await cloudSql("CREATE TABLE IF NOT EXISTS _ddl_applied (h TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW())");
      const { rows } = await cloudSql("SELECT h FROM _ddl_applied");
      return new Set(rows.map((r) => String(r.h)));
    })().catch((e) => {
      appliedDdl = null;
      throw e;
    });
  }
  return appliedDdl;
}

async function cloudQuery(text: string): Promise<CompatResult> {
  if (!IDEMPOTENT_DDL.test(text)) return cloudSql(text);
  const h = ddlHash(text);
  const applied = await loadApplied();
  if (applied.has(h)) return { rows: [], rowCount: 0 };
  const res = await cloudSql(text);
  applied.add(h);
  await cloudSql(`INSERT INTO _ddl_applied (h) VALUES ('${h}') ON CONFLICT DO NOTHING`);
  return res;
}
