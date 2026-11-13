// Inlines tagged-template values as quoted Postgres literals (standard_conforming_strings on).
// Every value becomes an untyped literal, so Postgres infers its type from context exactly
// like an unbound query parameter would.

function arrayElement(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  if (Array.isArray(v)) return pgArrayLiteral(v);
  const s = v instanceof Date ? v.toISOString() : typeof v === "object" ? JSON.stringify(v) : String(v);
  return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/** JS array -> Postgres array literal text, e.g. ["a", null] -> {"a",NULL}. */
export function pgArrayLiteral(values: unknown[]): string {
  return `{${values.map(arrayElement).join(",")}}`;
}

export function sqlLiteral(v: unknown): string {
  if (v === null || v === undefined) return "NULL";
  let s: string;
  if (v instanceof Date) s = v.toISOString();
  else if (typeof v === "bigint") s = v.toString();
  else if (typeof v === "number") {
    if (!Number.isFinite(v)) return "NULL";
    s = String(v);
  } else if (typeof v === "boolean") s = v ? "true" : "false";
  else if (Array.isArray(v)) s = pgArrayLiteral(v);
  else if (typeof v === "object") s = JSON.stringify(v);
  else s = String(v);
  if (s.includes("\u0000")) throw new Error("invalid_sql_value");
  return `'${s.replace(/'/g, "''")}'`;
}

export function inlineSql(strings: readonly string[], values: readonly unknown[]): string {
  let text = strings[0] ?? "";
  for (let i = 1; i < strings.length; i++) text += sqlLiteral(values[i - 1]) + strings[i];
  return text;
}
