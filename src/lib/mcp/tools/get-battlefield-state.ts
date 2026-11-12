import { defineTool } from "@lovable.dev/mcp-js";

export default defineTool({
  name: "get_battlefield_state",
  title: "Get battlefield state",
  description: "Live faction sector holdings, 24h faction and market volume, radiation level and the latest public combat feed.",
  inputSchema: {},
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: true },
  handler: async () => {
    const { battlefieldState } = await import("@/lib/war-room/snapshot.server");
    const s = await battlefieldState();
    const data = {
      generatedAt: new Date(s.generatedAt).toISOString(),
      marketError: s.error,
      factionVolumeUsd: s.factionVolumeUsd,
      marketVolumeUsd: s.marketVolumeUsd,
      radiation: { level: s.radiation.level, band: s.radiation.band, shield: s.radiation.shield },
      sectors: s.sectors.map((x) => ({ faction: x.symbol, master: x.master, volume24hUsd: x.volume24hUsd, liquidityUsd: x.liquidityUsd, control: x.dominance })),
      combat: s.combat.map((c) => ({ attacker: c.attacker, victim: c.victim, weapon: c.weapon, hit: c.hit, glory: c.glory, at: new Date(c.at).toISOString() })),
    };
    return { content: [{ type: "text", text: JSON.stringify(data) }], structuredContent: data };
  },
});
