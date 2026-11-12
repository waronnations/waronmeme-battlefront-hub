import { createFileRoute } from "@tanstack/react-router";

// Procedural SVG image for items without an AI picture.
export const Route = createFileRoute("/api/public/nft/$assetId/image")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const id = Number(params.assetId);
        if (!Number.isInteger(id) || id <= 0) return new Response("Not found", { status: 404 });
        const { hasDatabase, ensureSchema } = await import("@/lib/db.server");
        if (!hasDatabase()) return new Response("Unavailable", { status: 503 });
        await ensureSchema();
        const { sql } = await import("@/lib/db/client.server");
        const { rows } = await sql`SELECT recipe FROM assets WHERE id = ${id}`;
        if (!rows[0]) return new Response("Not found", { status: 404 });
        const { renderToStaticMarkup } = await import("react-dom/server");
        const { createElement } = await import("react");
        const { AssetArt } = await import("@/components/assets/AssetArt");
        const svg = renderToStaticMarkup(createElement(AssetArt, { recipe: rows[0]["recipe"] as never }));
        return new Response(svg.replace("<svg ", '<svg xmlns="http://www.w3.org/2000/svg" '), {
          headers: { "Content-Type": "image/svg+xml", "Cache-Control": "public, max-age=86400" },
        });
      },
    },
  },
});
