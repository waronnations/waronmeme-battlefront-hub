import { createFileRoute } from "@tanstack/react-router";

// Public TEP-64 NFT metadata (read-only, exposes only item traits).
export const Route = createFileRoute("/api/public/nft/$assetId")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const id = Number(params.assetId);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        const { hasDatabase, ensureSchema } = await import("@/lib/db.server");
        if (!hasDatabase()) return new Response("Unavailable", { status: 503 });
        await ensureSchema();
        const { nftMetadata } = await import("@/lib/nft/nft.server");
        const meta = await nftMetadata(id, new URL(request.url).origin);
        if (!meta) return new Response("Not found", { status: 404 });
        return Response.json(meta, { headers: { "Cache-Control": "public, max-age=300" } });
      },
    },
  },
});
