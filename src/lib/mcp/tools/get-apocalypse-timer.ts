import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_apocalypse_timer",
  title: "Get Apocalypse timer",
  description: "Doomsday clock countdown and the ranked surviving factions by survival score.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async () => {
    const { apocalypseTimer } = await import("@/lib/war-room/snapshot.server");
    const t = await apocalypseTimer();
    const data = {
      msLeft: t.msLeft,
      detonated: t.detonated,
      survivors: t.survivors.map((s) => ({ rank: s.rank, symbol: s.symbol, master: s.master, score: s.score, share: s.share, convictionHolders: s.convictionHolders })),
    };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
