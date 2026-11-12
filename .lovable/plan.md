# War On Memes: Multi-Chain & Apocalypse Overhaul

Built in the order below. Each phase ends with typecheck + tests green before the next starts.

## Phase 1 — Command Briefing lore (small, first)
- Add the antagonist monologue as the opening transmission in the Daily Command Briefing, typed out line by line, with the existing sound + haptic.

## Phase 2 — Public War Room (/war-room)
- New view-only page anyone can open. Admin tools stay at /admin behind the wallet allowlist (verify the allowlist check is enforced on the server, not just hidden in the UI).
- 3D holographic globe / sector grid showing $UTYA, $WARDOG, $WARCAT, $GRAM territories, pulsing with trading volume. Mobile-first, low draw-call budget, falls back to a 2D grid if 3D can't start.
- Live HUD: total volume routed, combat feed, radiation level, top landlords, Doomsday countdown.
- Audio with mute toggle: radar hum, radio clicks, Geiger counter that speeds up with radiation; synced with Telegram haptics. Muted by default until first tap (browser rule).
- "Share Battle Intel" button: makes a high-contrast dossier image (9:16, Telegram Stories size) with callsign and referral link, using the existing share card system.

## Phase 3 — Agent Protocol (public read-only tools for AI bots)
- Read-only tools: battlefield state, sector dominance (24h volume per token), vault status (prize pool totals + recent claims, no wallet-level personal data), Apocalypse timer + faction ranks.
- Served from the app's standard agent endpoint (/mcp), plus a plain JSON /api/public/agents summary for simple scripts.
- "Agent Connect Protocol" pop-up in the War Room explaining URLs and tool shapes for ElizaOS, Claude and custom scripts.
- You'll be asked to confirm public (no-login) access before this is switched on.

## Phase 4 — Pump.fun route + Air Support Bounties
- Add a Pump.fun route to Rewards → Swap next to swap.coffee, STON.fi, DeDust, TONCO.
- Solana signing through Keeper's built-in Solana key, if Keeper exposes it to web apps; otherwise the route is shown as quote-only with the reason stated.
- Curve metrics (progress, market cap, liquidity, graduated) through the existing cache.
- Air Support Bounties: a whale funds a GRAM pool for a target faction token and raid window; players trading that token during the raid earn shares, paid through the War Vault voucher flow.

## Phase 5 — Lighter server, cosmetic data on the device
- Move to the device (IndexedDB): shooter particle settings, briefing streak display cache, UI preferences.
- Read token balances and sector volumes straight from public TON / TonAPI / Solana endpoints where the data is public.
- Keep on the server: anything that can earn payouts (inventory, forged weapons, scores, streak rewards) plus voucher signing. Putting these only on the device would let players edit them and drain the vault.

## Phase 6 — Endgame economy
- Faction allegiance (holdings/swaps) unlocks weapon effects (Fire, Cyber Laser, Toxic Acid) and daily drop multipliers, added to the pure Apocalypse engine so perks never promise bonuses that don't exist.
- Sector trading volume adds radiation shielding on the Doomsday clock.
- Final settlement: surviving bunker holders get signed multi-asset vouchers claimable from WarVault.tact.

## Phase 7 — Security + verification
- Strict ton_proof (Ed25519) check on every wallet login: domain, timestamp window, payload nonce, public key matches address.
- Voucher nonces single-use and deadlines enforced on server and in WarVault.tact; tests for replay and expiry.
- Full typecheck, test suite (target 185+ tests), bundle check for import-time errors, and a preview walkthrough of /war-room and Swap.

## Open items that may block parts
- Keeper Solana signing API for web apps (Phase 4) — needs confirming.
- GRAM_JETTON_MASTER address, WAR_VAULT_SIGNER_KEY, TONAPI key, deployed WarVault address (Phases 4, 6, 7).
- $WARCAT has no DEX liquidity yet, so its territory volume shows 0 until a pool exists.

## Technical notes
- War Room: React Three Fiber on a `ssr: false` route; volume data via `useCachedQuery`; HUD uses existing `holo-panel`/`hud-*` classes.
- Agent tools: `@lovable.dev/mcp-js`, one tool per file in `src/lib/mcp/`, reading through anon-safe public queries only.
- Bounties need new tables (bounties, bounty_contributions) with RLS; payouts reuse the open-voucher unique index.
