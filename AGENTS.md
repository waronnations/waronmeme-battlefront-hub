<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.
<!-- LOVABLE:END -->

- Preserve the imported file-based TanStack routes and game modules; retain this project’s managed integration files and framework versions because source project settings and credentials are project-scoped.
- War Vault signs claims with WAR_VAULT_SIGNER_KEY (falls back to CLAIM_SIGNER_PRIVATE_KEY); a partial unique index allows one open voucher per player per asset, because parallel requests must never lock the same balance twice.
- vite.config buffer alias must stay an exact-match regex (/^buffer$/): a string key also matches "buffer/" and the dev bundler loops until it runs out of memory.
- Pop-ups use `src/components/ui/TacticalModal.tsx` (portaled to body, sound + haptic on open) so every dialog shares one HUD style and sits above animated tab containers.
- Client reads of market data go through `src/lib/cache/metric-cache.ts` (`useCachedQuery`), because tabs remount on switch and must paint from cache instead of refetching.
- Apocalypse radiation, apex standings and bunker perks live in pure `src/lib/apocalypse/engine.ts`; perks may only restate rules the game already applies, so the UI never promises bonuses that don't exist.
- Quick swaps are quoted live from swap.coffee per venue (`src/lib/dex/routes.ts` + `routes.server.ts`; simulated `coffeeswap.ts` only as offline fallback), only through WHITELISTED/COMMUNITY jettons, and executed in-game: the server re-quotes and has swap.coffee build the tx, `checkSwapTxs` caps the GRAM sent at amount + gas, and the player signs via TonConnect — never by sending them to an outside app.
- Game screens build from shared HUD classes in `src/styles.css` (`holo-panel`, `hud-card`, `hud-title`, `hud-label`, `hud-chip`, `hud-input`, `hud-segment`, `cta-*`) and theme tokens only, never palette classes like zinc-/amber-, so the whole game restyles from one place.
- Public War Room data, the MCP tools and /api/public/agents all read from `src/lib/war-room/snapshot.server.ts`, so every public surface exposes the same aggregated, non-personal data.
- Wallet ownership is proven with ton_proof via `src/lib/onchain/ton-proof*.ts` (server-signed one-time payload + Ed25519 check); never trust a wallet address sent alone.
- Game SQL runs on Neon when NEON_API_KEY/DATABASE_URL is set, otherwise on Lovable Cloud through the service-role-only `public.game_exec_sql` (tables in schema `game`, values inlined by `src/lib/db/sql-literal.ts`), so the raw-SQL game layer needs no rewrite; applied DDL is remembered in `_ddl_applied` so cold workers skip the bootstrap.
- Bunker LP rules live in pure `src/lib/bunker/lp.ts` (pool pick, fee split, deposit quote, gas cap, pledge status); deposits only go to recommended STON.fi v2 GRAM pools above the minimum depth, and pledges are non-custodial (LP stays in the player's wallet and is re-read on-chain).
