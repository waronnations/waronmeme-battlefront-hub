import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_sector_dominance",
  title: "Get sector dominance",
  description: "24h trading volume, liquidity, price and control share for each faction memecoin (UTYA, WARDOG, WARCAT, GRAM).",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async () => {
    const { battlefieldState } = await import("@/lib/war-room/snapshot.server");
    const s = await battlefieldState();
    const data = {
      totalVolumeUsd: s.factionVolumeUsd,
      sectors: s.sectors.map((x) => ({ faction: x.symbol, master: x.master, volume24hUsd: x.volume24hUsd, liquidityUsd: x.liquidityUsd, priceUsd: x.priceUsd, control: x.dominance })),
    };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
