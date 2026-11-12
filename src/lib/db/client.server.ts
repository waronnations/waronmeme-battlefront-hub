/**
 * War On Nations — Neon Postgres client (server-only).
 * Low-level tagged-template `sql` helper. Queries go through the Lovable
 * connector gateway (NEON_API_KEY); the connection string never lives in code.
 * Falls back to a direct DATABASE_URL via @neondatabase/serverless if set.
 */

import { neon } from "@neondatabase/serverless";

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

export function hasDatabase(): boolean {
  return hasGateway() || Boolean(directUrl());
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
  if (!url) throw new Error("Database not configured");
  const rows = (await neon(url)(strings, ...values)) as Record<string, unknown>[];
  return { rows: rows ?? [], rowCount: rows?.length ?? 0 };
}
