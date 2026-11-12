// Plain-JSON agent feed: same public, read-only data as the MCP tools.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" };
const Query = z.object({ tool: z.enum(["get_battlefield_state", "get_sector_dominance", "get_vault_status", "get_apocalypse_timer"]).optional() });

export const Route = createFileRoute("/api/public/agents")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      GET: async ({ request }) => {
        const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
        if (!parsed.success) return Response.json({ error: "unknown tool" }, { status: 400, headers: CORS });
        const snap = await import("@/lib/war-room/snapshot.server");
        const tool = parsed.data.tool;
        const body =
          tool === "get_vault_status"
            ? await snap.vaultStatus()
            : tool === "get_apocalypse_timer"
              ? await snap.apocalypseTimer()
              : tool
                ? await snap.battlefieldState()
                : {
                    protocol: "war-on-memes-agents/1",
                    mcp: new URL("/mcp", request.url).toString(),
                    tools: ["get_battlefield_state", "get_sector_dominance", "get_vault_status", "get_apocalypse_timer"],
                    snapshot: await snap.warRoomSnapshot(),
                  };
        return Response.json(body, { headers: { ...CORS, "Cache-Control": "public, max-age=30" } });
      },
    },
  },
});
