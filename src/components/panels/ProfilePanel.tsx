// src/components/panels/ProfilePanel.tsx
import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Link } from "@tanstack/react-router";
import {
  Copy,
  ExternalLink,
  Twitter,
  ShieldAlert,
  RefreshCw,
  Wallet,
  Crosshair,
  Shield,
} from "lucide-react";
import type { GameState } from "@/lib/game-state";
import type { SessionUser } from "@/hooks/use-telegram-session";
import { getRankForGlory } from "@/lib/ranks";
import { getUnit } from "@/lib/units";
import { haptic } from "@/lib/telegram";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { MAX_ENERGY } from "@/lib/constants";
import { TreasuryCard } from "@/components/TreasuryCard";
import { redeemTraitorFn } from "@/lib/nations.functions";
import { usePayments } from "@/components/payments/PaymentProvider";
import { getClaims } from "@/lib/claims.functions";

export type PayToken = "wardog" | "warcat";

export function ProfilePanel({
  state,
  user,
  authenticated = false,
}: {
  state: GameState;
  user?: SessionUser | null;
  authenticated?: boolean;
}) {
  const { pay, connected, address, disconnectWallet } = usePayments();
  const rank = getRankForGlory(state.glory);
  const [redeeming, setRedeeming] = useState<string | null>(null);

  // Authoritative claimable (same source as Earn → Claim)
  const [claimable, setClaimable] = useState({ wardog: 0, warcat: 0 });
  const [claimed, setClaimed] = useState({ wardog: 0, warcat: 0 });
  const [totalEarned, setTotalEarned] = useState({ wardog: 0, warcat: 0 });
  const [loadingBalances, setLoadingBalances] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const isTraitor = Boolean(
    (state as any).isTraitor ?? (user as any)?.isTraitor,
  );

  const wardog = claimable.wardog;
  const warcat = claimable.warcat;

  const refreshClaimable = useCallback(async () => {
    setLoadingBalances(true);
    try {
      const snap = await getClaims();
      // Match ClaimPanel: accept full snapshot (has claims + balances)
      if (snap && typeof snap === "object" && "balances" in snap) {
        const bal = (snap as any).balances ?? {};
        const cl = (snap as any).claimed ?? {};
        const tot = (snap as any).total ?? {};
        setClaimable({
          wardog: Number(bal.wardog ?? 0),
          warcat: Number(bal.warcat ?? 0),
        });
        setClaimed({
          wardog: Number(cl.wardog ?? 0),
          warcat: Number(cl.warcat ?? 0),
        });
        setTotalEarned({
          wardog: Number(tot.wardog ?? 0),
          warcat: Number(tot.warcat ?? 0),
        });
        setHasLoadedOnce(true);
      }
    } catch {
      // keep previous values
    } finally {
      setLoadingBalances(false);
    }
  }, []);

  // Load on mount + whenever auth flips true + when local ledger tokens change
  useEffect(() => {
    void refreshClaimable();
  }, [refreshClaimable, authenticated, state.wardogTokens, state.warcatTokens]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
      haptic("light");
    } catch {
      toast.error("Copy failed");
    }
  };

  const handleRedeemPaid = async (payWith: PayToken) => {
    if (redeeming) return;
    setRedeeming(payWith);
    try {
      const auth = await pay("nation:redeem");
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await redeemTraitorFn({ data: { pay: true, payWith } });
      toast.success(
        `Traitor status cleared with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`,
      );
      haptic("heavy");
      void refreshClaimable();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      if (msg.includes("insufficient_tokens")) {
        toast.error(
          payWith === "wardog" ? "Not enough $WARDOG" : "Not enough $WARCAT",
        );
      } else if (msg.includes("not_traitor")) {
        toast.error("You are not a traitor");
      } else {
        toast.error("Redeem failed");
      }
    } finally {
      setRedeeming(null);
    }
  };

  const handleRedeemCooldown = async () => {
    if (redeeming) return;
    setRedeeming("cooldown");
    try {
      await redeemTraitorFn({ data: { pay: false } });
      toast.success("Traitor status cleared (cooldown)");
      haptic("medium");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Redeem failed";
      if (msg.includes("cooldown_not_over")) {
        toast.error("Cooldown not over yet");
      } else if (msg.includes("not_traitor")) {
        toast.error("You are not a traitor");
      } else {
        toast.error("Redeem failed");
      }
    } finally {
      setRedeeming(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="holo-panel holo-scan p-4">
        <div className="text-center">
          <div className="hud-title justify-center">
            <Shield className="h-4 w-4 text-neon-cyan" /> Commander
          </div>
          <div className="mt-1 text-xl font-mono font-black text-foreground">
            {user?.firstName || user?.username || "Soldier"}
          </div>
          <div className="mt-1 text-sm font-bold text-neon-amber">
            {rank.name} · T{state.highestTier}
          </div>
          {authenticated && (
            <div className="mt-1 text-[0.6rem] uppercase tracking-widest text-neon-green">
              Live · Server synced
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="hud-card p-3 text-center">
            <div className="text-lg font-mono font-black neon-text-amber">
              {state.glory.toLocaleString()}
            </div>
            <div className="hud-label">
              Glory
            </div>
          </div>
          <div className="hud-card p-3 text-center">
            <div className="text-lg font-mono font-black text-foreground">
              {state.totalMerges.toLocaleString()}
            </div>
            <div className="hud-label">
              Merges
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between hud-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Wallet
            className={`h-4 w-4 shrink-0 ${connected ? "text-neon-green" : "text-muted-foreground"}`}
          />
          <div className="min-w-0">
            <div className="hud-label">
              {connected ? "Wallet connected" : "Wallet offline"}
            </div>
            <div className="truncate font-mono text-[0.65rem] text-muted-foreground">
              {connected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : "Connects on paid actions · stays until disconnect"}
            </div>
          </div>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => void disconnectWallet()}
            className="min-h-11 shrink-0 rounded-lg border border-border px-2 py-1 hud-label hover:border-border hover:text-foreground bg-transparent text-foreground"
          >
            Disconnect
          </button>
        )}
      </div>

      {isTraitor && (
        <div className="holo-panel p-4 border-destructive/40">
          <div className="hud-title">
            <ShieldAlert className="h-4 w-4 text-destructive" />
            Traitor Status
          </div>
          <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
            Paid redemption needs a connected wallet (once), then spends $WARDOG
            or $WARCAT — never native GRAM. Or wait the 7-day cooldown for free.
          </p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => void handleRedeemPaid("wardog")}
              disabled={!!redeeming || wardog < 0.001}
              className="min-h-11 flex items-center justify-center gap-1.5 rounded-xl border border-destructive/50 bg-destructive/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-destructive disabled:opacity-50 border-border bg-transparent text-foreground"
            >
              {redeeming === "wardog" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              $WARDOG
            </button>
            <button
              type="button"
              onClick={() => void handleRedeemPaid("warcat")}
              disabled={!!redeeming || warcat < 0.001}
              className="min-h-11 flex items-center justify-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-neon-cyan/40 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-neon-cyan disabled:opacity-50 border-border bg-transparent text-foreground"
            >
              {redeeming === "warcat" ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : null}
              $WARCAT
            </button>
          </div>
          <button
            type="button"
            onClick={() => void handleRedeemCooldown()}
            disabled={!!redeeming}
            className="min-h-11 mt-2 flex w-full items-center justify-center gap-2 hud-card p-3 text-[0.65rem] font-bold uppercase tracking-wider text-foreground disabled:opacity-50 border border-border bg-transparent"
          >
            {redeeming === "cooldown" ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            Wait Cooldown (free · no wallet)
          </button>
        </div>
      )}

      <div className="holo-panel p-4">
        <h3 className="mb-3 hud-title">
          <Shield className="h-4 w-4 text-neon-cyan" /> Command Stats
        </h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <Stat label="Highest Tier" value={`T${state.highestTier}`} />
          <Stat label="Daily Streak" value={`${state.dailyStreak} days`} />
          <Stat label="Energy" value={`${state.energy}/${MAX_ENERGY}`} />
          <Stat label="Referral Code" value={state.referralCode} />
          <Stat label="Nukes Today" value={state.nukesUsedToday ?? 0} />
          <Stat label="Recruits" value={state.referrals?.length ?? 0} />
        </div>
      </div>

      {/* Token Vault – same server source as Earn → Claim */}
      <div className="holo-panel p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="hud-title">
            <Wallet className="h-4 w-4 text-neon-green" /> Token Vault (claimable rewards)
          </h3>
          <button
            type="button"
            onClick={() => void refreshClaimable()}
            disabled={loadingBalances}
            className="min-h-11 text-muted-foreground hover:text-foreground border border-border bg-transparent text-foreground"
            title="Refresh claimable balances"
          >
            <RefreshCw
              className={`h-3.5 w-3.5 ${loadingBalances ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <TokenCard
            token={TOKENS.wardog}
            claimable={wardog}
            claimed={claimed.wardog}
            total={totalEarned.wardog}
            loading={loadingBalances && !hasLoadedOnce}
            onCopy={(t) => copy(t, "Address")}
          />
          <TokenCard
            token={TOKENS.warcat}
            claimable={warcat}
            claimed={claimed.warcat}
            total={totalEarned.warcat}
            loading={loadingBalances && !hasLoadedOnce}
            onCopy={(t) => copy(t, "Address")}
          />
        </div>

        <div className="mt-3 rounded-lg border border-neon-green/20 bg-neon-green/20 px-3 py-2 text-[0.6rem] leading-relaxed text-neon-green/80">
          <strong className="text-neon-green">Claimable</strong> = merge
          rewards still available to claim in Earn → Claim (net of protocol
          taxes).
          <br />
          Same server source as the Claim Center.
        </div>
      </div>

      <TreasuryCard />

      <div className="holo-panel p-4">
        <h3 className="mb-3 hud-title">
          <Crosshair className="h-4 w-4 text-destructive" /> WARDOG ARMORY
        </h3>
        <UnitRow faction="dog" highest={state.highestTier} />

        <h3 className="mb-3 mt-5 hud-title">
          <Crosshair className="h-4 w-4 text-neon-cyan" /> WARCAT ARMORY
        </h3>
        <UnitRow faction="cat" highest={state.highestTier} />
      </div>

      <div className="holo-panel p-4">
        <h3 className="mb-3 flex items-center gap-2 hud-title">
          <Twitter className="h-4 w-4 text-neon-cyan" /> Socials
        </h3>
        <a
          href="https://x.com/waronnations"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between hud-card p-3 hover:border-neon-amber/40"
        >
          <div>
            <div className="text-sm font-bold text-foreground">@waronnations</div>
            <div className="hud-label">
              Follow on X
            </div>
          </div>
          <ExternalLink className="h-4 w-4 text-neon-amber" />
        </a>
      </div>

      <div className="holo-panel p-4">
        <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 hud-label">
          <Link to="/privacy" className="hover:text-destructive">
            Privacy Policy
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link to="/terms" className="hover:text-destructive">
            Terms of Service
          </Link>
          <span className="text-muted-foreground">·</span>
          <a
            href="https://x.com/waronnations"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-destructive"
          >
            @waronnations
          </a>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="hud-card p-3">
      <div className="hud-label">
        {label}
      </div>
      <div className="truncate text-lg font-mono font-black text-foreground">{value}</div>
    </div>
  );
}

function TokenCard({
  token,
  claimable,
  claimed,
  total,
  loading,
  onCopy,
}: {
  token: (typeof TOKENS)["wardog"];
  claimable: number;
  claimed: number;
  total: number;
  loading?: boolean;
  onCopy: (text: string) => void;
}) {
  return (
    <div
      className="relative overflow-hidden hud-card p-3"
    >
      <div className="flex items-center justify-between">
        <div
          className={`hud-label ${token.symbol.includes("WARDOG") ? "text-destructive" : "text-neon-cyan"}`}
        >
          {token.symbol}
        </div>
        <div className="hud-label">
          claimable
        </div>
      </div>

      <div className="mt-1 text-xl font-mono font-black text-foreground">
        {loading ? "…" : claimable.toFixed(2)}
      </div>

      <div className="mt-1.5 space-y-0.5 text-[0.55rem] text-muted-foreground">
        <div>
          Claimed ·{" "}
          <span className="text-muted-foreground">
            {loading ? "…" : claimed.toFixed(2)}
          </span>
        </div>
        <div>
          Total earned ·{" "}
          <span className="text-muted-foreground">
            {loading ? "…" : total.toFixed(2)}
          </span>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onCopy(token.contractAddress)}
        className="min-h-11 mt-2 flex w-full items-center justify-between rounded-lg bg-transparent px-2 py-1.5 font-mono text-[0.6rem] text-foreground hover:bg-transparent border border-border"
        title={token.contractAddress}
      >
        <span className="truncate">
          {shortenAddress(token.contractAddress, 6, 6)}
        </span>
        <Copy className="h-3 w-3 shrink-0" />
      </button>

      <div className="mt-1 flex gap-1">
        <a
          href={token.tonviewer}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-background/40 px-2 py-1 hud-label hover:bg-background/60"
        >
          Tonviewer <ExternalLink className="h-2.5 w-2.5" />
        </a>
        <a
          href={token.dedust}
          target="_blank"
          rel="noopener noreferrer"
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-background/40 px-2 py-1 hud-label hover:bg-background/60"
        >
          DeDust <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>
    </div>
  );
}

function UnitRow({
  faction,
  highest,
}: {
  faction: "dog" | "cat";
  highest: number;
}) {
  return (
    <div className="grid grid-cols-5 gap-2">
      {[1, 2, 3, 4, 5].map((t) => {
        const u = getUnit(faction, t);
        const isUnlocked = highest >= t;
        return (
          <div
            key={t}
            className={`flex aspect-square flex-col items-center justify-center hud-card p-3 ${
              isUnlocked
                ? "border-border bg-background"
                : "border-border bg-background/50 opacity-40"
            }`}
          >
            {isUnlocked ? (
              <img
                src={u.image}
                alt={u.name}
                loading="lazy"
                className="h-9 w-9 object-contain"
              />
            ) : (
              <div className="h-9 w-9 rounded bg-secondary" aria-hidden />
            )}
            <span className="mt-0.5 text-[0.55rem] font-bold text-muted-foreground">
              T{t}
            </span>
          </div>
        );
      })}
    </div>
  );
}
