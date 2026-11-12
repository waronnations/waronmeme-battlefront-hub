# Waronmemes copy

- [x] Copy source application, routes, local images, contracts, scripts, and tests.
- [x] Preserve target project identity, managed Cloud configuration, and pinned framework packages.
- [x] Run copied tests: 142 passed across 21 files; typecheck reports build OK.
- [ ] Verify preview navigation: blocked by preview plugin-host memory limit (3072MB) while loading the full source app.
- [ ] Connect original external services: requires provider credentials not included in snapshots.
- [ ] Import existing player data: requires source-project exports; code checkout contains no database records.

# Apocalypse Protocol & Tactical Overhaul

- [x] Shared tactical pop-up (TacticalModal) used by briefing, supply drop, conquest victory and vault claim.
- [x] Apocalypse engine + Doomsday banner (countdown, radiation meter, apex survivor, warnings, bunker perks).
- [x] Metric/image cache (memory + localStorage LRU with TTL) + CachedTokenImage.
- [x] CoffeeSwap quick-swap scaffold (simulated quotes, slippage, route, deep link, TonConnect payload builder).
- [x] Wire banner on game screen; tests for cache, engine, swap quotes; build + tests green.
- [x] In-game swaps: chosen route is built by swap.coffee and signed in the player's wallet (no outside app). x1000 curve stays quote-only.
- [ ] GRAM option: needs GRAM_JETTON_MASTER address.

# Design + GRAM pass

- [x] Every player pop-up uses the tactical "Incoming transmission" style (tutorial, welcome back, hybrids, trophy art, nuke lock, jail, top-up, payment, API key, strike, share, dispatch, nation actions, nation details, forge result, armory).
- [x] Native coin shown as GRAM everywhere (war chest, vault, claim gas, retreat, swap, routes).
- [x] War chest payout countdown no longer shows 0d 00:00:00 while loading.
- [x] All game screens (top bar, menus, war board, ops, battlefield controls, season, nations, nukes, rewards, shop, claim, packs, profile, forge, armory) moved to the HUD style.

# Swap routes

- [x] Route selector in Quick swap: Best rate (swap.coffee), STON.fi, DeDust, TONCO direct, x1000 memepad curve — live quotes per venue.
- [x] Safe jetton badges (verified / safe contract / unverified / blocked); unsafe tokens and routes through them are refused.
- [x] Graduation indicator and bonding-curve progress for memepad tokens.
- [ ] Memes Lab route: no public bonding-curve data found; needs a data source or link from the team.
- [ ] $WARCAT routes: no pool with liquidity on any DEX yet.
