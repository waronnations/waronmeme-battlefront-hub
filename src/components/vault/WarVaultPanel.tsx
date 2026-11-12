import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { toast } from "sonner";
import { CheckCircle2, Crown, History, Map as MapIcon, RefreshCw, ShieldCheck, Vault, Wallet } from "lucide-react";
import { TacticalCTA, TacticalModal, TacticalSection, tacticalFeedback } from "@/components/ui/TacticalModal";
import { shortenAddress } from "@/lib/tokens";
import { ActionButton } from "@/components/ActionButton";
import { claimVaultFn, getVaultFn, markVoucherSentFn, refreshPerksFn } from "@/lib/vault.functions";
import { canClaim, LANDLORD_MULTIPLIER, LEADERBOARD_PAID_RANKS, POOL_SPLIT } from "@/lib/vault/vault";
import { haptic, hapticNotify } from "@/lib/telegram";
import { WarChestTicker, fmtAmount } from "./WarChestTicker";

type VaultData = Awaited<ReturnType<typeof getVaultFn>>;
type LiveVault = Extract<VaultData, { available: true }>;

export function WarVaultPanel({ authenticated }: { authenticated: boolean }) {
  const getVault = useServerFn(getVaultFn);
  const claim = useServerFn(claimVaultFn);
  const markSent = useServerFn(markVoucherSentFn);
  const checkPerks = useServerFn(refreshPerksFn);
  const [tonConnectUI] = useTonConnectUI();
  const connected = useTonAddress();
  const [data, setData] = useState<LiveVault | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [order, setOrder] = useState<{ key: string; symbol: string; amount: number; phase: "confirm" | "sending" | "sent" } | null>(null);

  const load = useCallback(async () => {
    if (!authenticated) {
      setLoading(false);
      return;
    }
    try {
      const r = await getVault();
      setData(r.available ? r : null);
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getVault]);

  useEffect(() => {
    void load();
  }, [load]);

  function requestClaim(assetKey: string, symbol: string, amount: number) {
    if (!connected) {
      haptic("light");
      return void tonConnectUI.openModal();
    }
    setOrder({ key: assetKey, symbol, amount, phase: "confirm" });
  }

  async function onClaim(assetKey: string, symbol: string) {
    setBusy(assetKey);
    setOrder((o) => (o ? { ...o, phase: "sending" } : o));
    try {
      const r = await claim({ data: { assetKey } });
      if (!r.ok) {
        hapticNotify("error");
        setOrder(null);
        return void toast.error(r.error);
      }
      const v = r.voucher;
      // Load the TON transaction builder only on demand so @ton/core never
      // runs at app launch (it needs Buffer, which browsers don't provide).
      const { Buffer } = await import("buffer");
      (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
      await import("@/lib/onchain/buffer-polyfill");
      const { buildVaultClaimTx } = await import("@/lib/onchain/vault-claim");
      await tonConnectUI.sendTransaction(buildVaultClaimTx(v));
      await markSent({ data: { nonce: v.nonce } });
      tacticalFeedback("reward", "success");
      setOrder({ key: assetKey, symbol, amount: v.displayAmount, phase: "sent" });
    } catch {
      setOrder(null);
      toast.message("Claim not sent. Your voucher stays valid for 24 hours, then the balance returns.");
    } finally {
      setBusy(null);
      void load();
    }
  }

  async function onCheckPerks() {
    setBusy("perks");
    try {
      const r = await checkPerks();
      if (!r.ok) return void toast.error(r.error);
      hapticNotify(r.perks?.landlord ? "success" : "warning");
      toast.message(r.perks?.landlord ? "Landlord verified — bonus active" : "No TonMap pixels found in this wallet");
    } catch {
      toast.error("Wallet check failed");
    } finally {
      setBusy(null);
      void load();
    }
  }

  return (
    <div className="space-y-4 pb-8">
      <WarChestTicker />

      {!authenticated && (
        <p className="holo-panel p-4 text-sm text-muted-foreground">Open the game in Telegram to see your War Vault.</p>
      )}

      {authenticated && loading && <div className="h-40 animate-pulse rounded-2xl bg-muted" />}

      {authenticated && !loading && !data && (
        <p className="holo-panel p-4 text-sm text-muted-foreground">Your vault will appear once saving is available.</p>
      )}

      {data && (
        <>
          <section aria-label="Your rewards" className="holo-panel p-4">
            <div className="flex items-center justify-between">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                <Wallet className="h-4 w-4 text-neon-cyan" /> Your War Vault
              </h3>
              {data.perks?.landlord && (
                <span className="inline-flex items-center gap-1 rounded-full border border-neon-amber px-2 py-0.5 text-[10px] font-black uppercase neon-text-amber">
                  <Crown className="h-3 w-3" /> Landlord ×{LANDLORD_MULTIPLIER}
                </span>
              )}
            </div>
            <div className="mt-3 space-y-2">
              {data.balances.map((b) => {
                const ok = canClaim(b.claimable, b);
                return (
                  <div key={b.key} className="flex items-center gap-3 rounded-xl border border-border bg-secondary/60 p-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-1.5">
                        <span className="font-mono text-lg font-black text-foreground">{fmtAmount(b.claimable)}</span>
                        <span className="text-xs font-bold text-muted-foreground">{b.symbol}</span>
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        Earned {fmtAmount(b.accrued)}
                        {b.locked > 0 && ` · ${fmtAmount(b.locked)} in claim`}
                        {!ok.ok && b.claimable > 0 && ` · ${ok.reason}`}
                      </div>
                    </div>
                    <ActionButton
                      onClick={() => requestClaim(b.key, b.symbol, b.claimable)}
                      disabled={!ok.ok || !data.live || busy !== null}
                      className="cta-deploy min-w-20 border-0 font-black uppercase"
                    >
                      {busy === b.key ? "…" : "Claim"}
                    </ActionButton>
                  </div>
                );
              })}
            </div>
            {!data.live && (
              <p className="mt-2 text-[11px] text-muted-foreground">Rewards are tracked now. Wallet claims open as soon as the War Vault contract goes live.</p>
            )}
          </section>

          <section aria-label="Holder perks" className="holo-panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
              <MapIcon className="h-4 w-4 text-neon-green" /> TonMap & GRAM perks
            </h3>
            <p className="mt-1 text-[11px] text-muted-foreground">
              Own TonMap pixels to become a Landlord: your weekly vault payout gets a {Math.round((LANDLORD_MULTIPLIER - 1) * 100)}% bonus and a gold badge.
            </p>
            {data.perks && (
              <div className="mt-2 grid grid-cols-2 gap-2 text-center">
                <div className="rounded-lg border border-border p-2">
                  <div className="font-mono text-base font-black text-foreground">{data.perks.pixels}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">Pixels</div>
                </div>
                <div className="rounded-lg border border-border p-2">
                  <div className="font-mono text-base font-black text-foreground">{fmtAmount(data.perks.gram)}</div>
                  <div className="text-[10px] uppercase text-muted-foreground">GRAM held</div>
                </div>
              </div>
            )}
            <ActionButton onClick={onCheckPerks} disabled={busy !== null || (!data.perksConfig.tonmap && !data.perksConfig.gram)} className="mt-3 w-full">
              <RefreshCw className={`h-3.5 w-3.5 ${busy === "perks" ? "animate-spin" : ""}`} />
              {data.wallet ? "Check my wallet" : "Connect a wallet in Claim first"}
            </ActionButton>
            {!data.perksConfig.tonmap && !data.perksConfig.gram && (
              <p className="mt-2 text-[11px] text-muted-foreground">Holder checks switch on once the TonMap collection is linked.</p>
            )}
          </section>

          <section aria-label="Reward rules" className="holo-panel p-4">
            <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
              <ShieldCheck className="h-4 w-4 text-neon-cyan" /> How the pool is paid
            </h3>
            <ul className="mt-2 space-y-1 text-[12px] text-foreground">
              <li><b className="neon-text-cyan">{POOL_SPLIT.leaderboard * 100}%</b> top {LEADERBOARD_PAID_RANKS} commanders by glory — higher rank, bigger share</li>
              <li><b className="neon-text-green">{POOL_SPLIT.faction * 100}%</b> winning faction, split by glory</li>
              <li><b className="neon-text-amber">{POOL_SPLIT.conviction * 100}%</b> conviction holders — full weight after 30 days</li>
              <li className="text-muted-foreground">Landlords get ×{LANDLORD_MULTIPLIER}. Unclaimed buckets roll into the leaderboard share.</li>
            </ul>
          </section>

          {data.history.length > 0 && (
            <section aria-label="Vault history" className="holo-panel p-4">
              <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
                <History className="h-4 w-4 text-muted-foreground" /> History
              </h3>
              <ul className="mt-2 divide-y divide-border">
                {data.history.map((h, i) => {
                  const sym = data.balances.find((b) => b.key === h.assetKey)?.symbol ?? "";
                  return (
                    <li key={i} className="flex items-center justify-between py-1.5 text-xs">
                      <span className="text-muted-foreground">
                        {h.type === "reward" ? "Weekly reward" : `Claim · ${h.label}`} · {new Date(h.at).toLocaleDateString()}
                      </span>
                      <span className={`font-mono font-bold ${h.type === "reward" ? "text-success" : "text-foreground"}`}>
                        {h.type === "reward" ? "+" : "−"}
                        {fmtAmount(h.amount)} {sym}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </>
      )}

      <TacticalModal
        open={order !== null}
        onClose={order?.phase === "sending" ? undefined : () => setOrder(null)}
        tone={order?.phase === "sent" ? "green" : "cyan"}
        badge={order?.phase === "sent" ? "Extraction complete" : "Extraction order"}
        badgeIcon={Vault}
        title={order?.phase === "sent" ? "Payout en route" : "Confirm vault claim"}
        subtitle={
          order?.phase === "sent"
            ? "Your wallet signed the claim. Tokens usually land within a minute."
            : "Your wallet will ask you to sign. The claim stays valid for 24 hours."
        }
        footer={
          order?.phase === "sent" ? (
            <TacticalCTA variant="deploy" buzz="light" onClick={() => setOrder(null)}>
              <CheckCircle2 className="h-5 w-5" /> Back to the vault
            </TacticalCTA>
          ) : (
            <>
              <TacticalCTA disabled={order?.phase === "sending"} onClick={() => order && void onClaim(order.key, order.symbol)}>
                <Wallet className="h-5 w-5" /> {order?.phase === "sending" ? "Waiting for wallet…" : "Sign in wallet"}
              </TacticalCTA>
              {order?.phase === "confirm" && (
                <TacticalCTA variant="ghost" buzz="light" onClick={() => setOrder(null)}>
                  Cancel
                </TacticalCTA>
              )}
            </>
          )
        }
      >
        {order && (
          <TacticalSection label={order.phase === "sent" ? "Sent" : "Claiming"}>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="font-mono text-2xl font-black tac-text">{fmtAmount(order.amount)}</span>
              <span className="text-sm font-bold text-foreground">{order.symbol}</span>
            </div>
            {connected && <div className="mt-1 font-mono text-[11px] text-muted-foreground">To {shortenAddress(connected, 6, 6)}</div>}
          </TacticalSection>
        )}
      </TacticalModal>
    </div>
  );
}
