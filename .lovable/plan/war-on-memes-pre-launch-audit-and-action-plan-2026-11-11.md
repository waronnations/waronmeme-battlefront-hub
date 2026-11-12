# War On Memes: Pre-Launch Audit and Action Plan

## What this covers
A full check of the new Daily Briefing, War Vault, Territory Radar, battlefield effects and the vault contract. It ends with a step-by-step plan to fix what's left and go live.

## Findings so far (from reading the code)
- All five new features exist in the project: briefing, vault panel plus prize ticker, territory radar, battlefield effects, and the WarVault contract.
- The vault creates its own data tables (pools, ledger, vouchers, assets, holder perks, player resources) the first time it runs. They are not tracked as migrations.
- Saved game data lives in an external Neon database, reached through the Neon connection key. It is not stored in Lovable Cloud.
- Two prize-claim systems exist side by side: the older Claim Treasury (`CLAIM_*` settings) and the new War Vault (`WAR_VAULT_*`). We need to pick one as the live path.
- The vault already signs claim vouchers with an Ed25519 key, and the contract checks that signature. The claim format still has to be checked byte-for-byte against the contract.
- Live-service keys still aren't set up after the import: Neon, TonAPI, Telegram bot, session secret, signer keys, and the vault/GRAM/TonMap addresses.

## Phase 1: Audit (no behavior changes)
1. Run the type check and the 142 existing tests. Write down every failure in the vault, briefing and battlefield files.
2. Open the app in a phone-sized browser. Test the Briefing, Vault and Battlefield tabs, check for console errors, and take screenshots.
3. Database: list the tables that really exist in Neon and compare them with the ones `ensureVaultTables()` and the game-cycle code expect. Check for missing indexes, unique limits on voucher nonces, and setup steps that can safely run twice.
4. Contract: compare the claim message format in `vault.server.ts` (fields, order, bit sizes, deadline, nonce) with the claim-message check in `WarVault.tact`.
5. Telegram: confirm the haptics, back button and close-confirmation features are skipped safely outside Telegram. Check that every button is at least 44px, safe areas are respected, and the app reacts when the connection drops or a request times out.

## Phase 2: Critical fixes (before launch)
- Fix any build, type or test failures found in Phase 1.
- Turn the vault table setup into versioned migrations. Add unique limits on (user, nonce) and on voucher replay. Make sure balance changes in the ledger are all-or-nothing.
- Show a clear "vault offline" state instead of crashing when `WAR_VAULT_SIGNER_KEY` or the database is missing.
- Set a rate limit and an expiry on each claim voucher. Check that the payout wallet matches the player's connected TonConnect wallet.
- Pick one prize-claim system (War Vault). Mark the old Claim Treasury as no longer used.

## Phase 3: Turning on real crypto claims
1. Generate an Ed25519 signer keypair offline. Store `WAR_VAULT_SIGNER_KEY` as a secret, and put the public key into the contract's starting settings.
2. Compile `WarVault.tact` and deploy it to testnet first. Record its address as `WAR_VAULT_ADDRESS`.
3. Set `GRAM_JETTON_MASTER`. Optionally set `TONMAP_COLLECTION_ADDRESS` so landlord bonuses can be detected. Set the vault's own jetton wallet address for each token.
4. Fund the vault on testnet. Run a full claim from start to finish: sign the voucher, send it through TonConnect, the contract pays out, the ledger marks it claimed. Then try reusing the same voucher, using an expired one, and using a wrong signature. All three must fail.
5. Turn on live mode (a single switch setting). Deploy to mainnet, fund the vault with a small amount, and watch it closely for 48 hours.

## Phase 4: Telegram polish
- Make buttons bigger where needed, respect safe areas, and fit the battlefield canvas to `viewportStableHeight`.
- Add an offline banner, retry with growing delays, and a cached last briefing.
- Lower the number of battlefield particles on weaker devices and pause effects when the app is hidden.

## Phase 5: Tests to add before launch
- Voucher signing matches the contract's expected format (a fixed known-good example).
- Daily supply drop: one per player per day, and the daily reset happens at the right time.
- Ledger: the balance can never go below zero, and a claim can't be paid twice.
- Territory ranking is decided by trading volume, and ties are broken the same way every time.
- Holder bonuses are detected correctly for TonMap and GRAM.

## Questions to settle
- Should game data stay on Neon, or move to Lovable Cloud?
- Testnet first, or straight to mainnet?
- How much should the vault be funded with at launch?
