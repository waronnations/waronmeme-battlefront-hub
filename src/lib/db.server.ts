/**
 * War On Nations — database entry point (server-only).
 * Re-exports the single client and the additive schema bootstrap.
 */
export { sql, hasDatabase } from "./db/client.server";
export { ensureSchema } from "./db/schema.server";
