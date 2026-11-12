import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_vault_status",
  title: "Get War Vault status",
  description: "This week's War Vault prize pool per asset (GRAM and faction tokens) and 7-day totals of paid claims. Aggregates only.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async () => {
    const { vaultStatus } = await import("@/lib/war-room/snapshot.server");
    const v = await vaultStatus();
    const data = {
      available: v.available,
      cycleKey: v.cycleKey,
      battleAt: v.battleAt ? new Date(v.battleAt).toISOString() : null,
      pools: v.pools.map((p) => ({ symbol: p.symbol, amount: p.amount })),
      recentClaims: v.recentClaims.map((c) => ({ symbol: c.symbol, claims: c.claims, amount: c.amount })),
    };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
