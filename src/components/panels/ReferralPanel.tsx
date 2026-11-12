// src/components/panels/ReferralPanel.tsx
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Copy, Users, RefreshCw } from "lucide-react";
import { useServerFn } from "@tanstack/react-start";
import type { GameState } from "@/lib/game-state";
import { haptic, shareUrl, getTelegram } from "@/lib/telegram";
import { track } from "@/lib/analytics";
import {
  getReferralStatus,
  claimReferralMilestone,
  MILESTONES,
  REFERRAL_BOT,
  type ReferralStatusPayload,
} from "@/lib/referrals.functions";
import {
  buildReferralLink,
  REFERRAL_QUALIFY_MIN_GLORY,
  REFERRAL_QUALIFY_MIN_MERGES,
} from "@/lib/referrals.shared";

const FALLBACK_MILESTONES: ReferralStatusPayload["milestones"] = MILESTONES.map(
  (m) => ({
    threshold: m.threshold,
    reward: m.reward,
    claimed: false,
    claimable: false,
  }),
);

export function ReferralPanel({
  state,
  authenticated,
  onServerReward,
  onCodeSync,
}: {
  state: GameState;
  authenticated: boolean;
  onServerReward: (stateJson: string) => void;
  onCodeSync?: (code: string) => void;
}) {
  const fetchStatus = useServerFn(getReferralStatus);
  const claim = useServerFn(claimReferralMilestone);

  const [status, setStatus] = useState<ReferralStatusPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const syncedCodeRef = useRef<string | null>(null);

  const loadStatus = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!authenticated) return;
      if (!opts?.silent) setRefreshing(true);
      try {
        const res = await fetchStatus();
        if (!res) {
          setError("No response from the server");
          return;
        }
        if ("error" in res) {
          setError(
            res.error === "database_unavailable"
              ? "Recruit HQ is offline — try again shortly"
              : res.error === "user_not_found"
                ? "Account not found — reopen the app from Telegram"
                : "Could not load recruit data",
          );
          return;
        }
        setError(null);
        setStatus(res);
        if (
          res.code &&
          res.code.length >= 5 &&
          res.code !== syncedCodeRef.current
        ) {
          syncedCodeRef.current = res.code;
          onCodeSync?.(res.code);
        }
      } catch {
        setError("Network error — pull to refresh");
      } finally {
        setRefreshing(false);
      }
    },
    [authenticated, fetchStatus, onCodeSync],
  );

  useEffect(() => {
    if (!authenticated) return;
    void loadStatus();
    const id = setInterval(() => void loadStatus({ silent: true }), 30_000);
    return () => clearInterval(id);
  }, [authenticated, loadStatus]);

  useEffect(() => {
    if (!authenticated) return;
    const onFocus = () => {
      if (document.visibilityState === "visible") {
        void loadStatus({ silent: true });
      }
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [authenticated, loadStatus]);

  const code = status?.code ?? state.referralCode;

  const link = useMemo(
    () =>
      status?.botUrl ??
      (code ? buildReferralLink(code) : `https://t.me/${REFERRAL_BOT}`),
    [status?.botUrl, code],
  );

  const referralCount = status?.referralCount ?? 0;
  const rawCount = status?.rawReferralCount ?? 0;
  const recruits = status?.recentRecruits ?? [];
  const minMerges = status?.qualify?.minMerges ?? REFERRAL_QUALIFY_MIN_MERGES;
  const minGlory = status?.qualify?.minGlory ?? REFERRAL_QUALIFY_MIN_GLORY;

  const shareText = useMemo(() => {
    return [
      "WAR ON NATIONS is live.",
      "",
      "Merge WARDOG & WARCAT units. Climb ranks. Earn $WARDOG & $WARCAT.",
      "Claim a country. Launch strategic nukes. Build your nation vault.",
      "",
      "Join my squad with this link (open inside Telegram):",
      link,
      code ? `My recruit code: ${code}` : "",
      "",
      "#WarOnNations #WARDOG #WARCAT",
    ]
      .filter(Boolean)
      .join("\n");
  }, [link, code]);

  const copy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`${label} copied`);
      haptic("light");
    } catch {
      toast.error("Copy failed — long-press to copy manually");
    }
  };

  const shareTelegram = () => {
    shareUrl(link, shareText);
    haptic("medium");
  };

  const shareX = () => {
    const intent = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}`;
    const tg = getTelegram();
    try {
      if (tg?.openLink) {
        tg.openLink(intent);
      } else if (typeof window !== "undefined") {
        window.open(intent, "_blank", "noopener,noreferrer");
      }
    } catch {
      if (typeof window !== "undefined") {
        window.location.href = intent;
      }
    }
    haptic("medium");
  };

  const doClaim = async (threshold: number) => {
    if (busy !== null) return;
    setBusy(threshold);
    try {
      const res = await claim({ data: { threshold } });
      if (!res.ok) {
        toast.error(
          res.error === "not_enough_referrals"
            ? "Not enough verified recruits yet"
            : res.error === "already_claimed"
              ? "Already claimed"
              : res.error === "database_unavailable"
                ? "Recruit HQ is offline — try again shortly"
                : "Unable to claim",
        );
        await loadStatus({ silent: true });
        return;
      }
      setStatus(res.status);
      setError(null);
      onServerReward(res.stateJson);
      if (res.status?.code) {
        syncedCodeRef.current = res.status.code;
        onCodeSync?.(res.status.code);
      }
      const r = res.reward;
      track("referral_claim", { threshold });
      toast.success(
        `+${r.glory.toLocaleString()}★  +${r.wardog} $WARDOG  +${r.warcat} $WARCAT`,
      );
      haptic("heavy");
    } catch {
      toast.error("Claim failed — check your connection");
    } finally {
      setBusy(null);
    }
  };

  const milestones = status?.milestones ?? FALLBACK_MILESTONES;
  const loading = authenticated && status === null && !error;

  return (
    <div className="space-y-3 pb-6">
      {/* Header / share */}
      <div className="holo-panel holo-scan p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <Users className="h-5 w-5 shrink-0 text-neon-cyan" />
            <h3 className="truncate hud-title">
              Recruit Command
            </h3>
          </div>
          {authenticated && (
            <button
              type="button"
              onClick={() => void loadStatus()}
              disabled={refreshing}
              aria-label="Refresh recruit data"
              className="min-h-11 flex shrink-0 items-center gap-1.5 rounded-lg bg-transparent px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:bg-transparent disabled:opacity-50 border border-border"
            >
              <RefreshCw
                className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          )}
        </div>

        {error && (
          <div className="mb-3 hud-card p-3 text-xs text-foreground">
            {error}
          </div>
        )}

        <p className="mb-3 text-[0.7rem] leading-relaxed text-muted-foreground">
          Recruits count only after they play:{" "}
          <span className="text-foreground">
            {minMerges}+ merges
          </span>{" "}
          or{" "}
          <span className="text-foreground">
            {minGlory}+ glory
          </span>
          . Empty joins do not unlock milestones.
        </p>

        <div className="mb-2 hud-label">
          Your code
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate hud-card p-3 font-mono text-sm text-foreground">
            {code || "—"}
          </div>
          <button
            type="button"
            onClick={() => code && void copy(code, "Code")}
            disabled={!code}
            aria-label="Copy referral code"
            className="min-h-11 shrink-0 rounded-lg bg-transparent p-2 text-foreground hover:bg-transparent disabled:opacity-40 border border-border"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="mb-2 hud-label">
          Invite link
        </div>
        <div className="mb-3 flex items-center gap-2">
          <div className="min-w-0 flex-1 truncate hud-card p-3 font-mono text-[0.65rem] text-foreground">
            {link}
          </div>
          <button
            type="button"
            onClick={() => void copy(link, "Link")}
            aria-label="Copy referral link"
            className="min-h-11 shrink-0 rounded-lg bg-transparent p-2 text-foreground hover:bg-transparent border border-border"
          >
            <Copy className="h-4 w-4" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={shareTelegram}
            className="min-h-11 rounded-xl cta-deploy hit-cta py-2.5 text-[0.7rem] font-black uppercase tracking-wider text-primary-foreground"
          >
            Share Telegram
          </button>
          <button
            type="button"
            onClick={shareX}
            className="min-h-11 hud-card p-3 text-[0.7rem] font-black uppercase tracking-wider text-foreground hover:border-border border border-border bg-transparent"
          >
            Share on X
          </button>
        </div>
      </div>

      {/* Counts */}
      <div className="grid grid-cols-2 gap-3">
        <div className="holo-panel p-4 text-center">
          <div className="hud-label">
            Verified
          </div>
          <div className="mt-1 text-2xl font-mono font-black text-foreground">
            {!authenticated ? "—" : loading ? "…" : referralCount}
          </div>
        </div>
        <div className="holo-panel p-4 text-center">
          <div className="hud-label">
            Total joined
          </div>
          <div className="mt-1 text-2xl font-mono font-black text-foreground">
            {!authenticated ? "—" : loading ? "…" : rawCount}
          </div>
        </div>
      </div>

      {authenticated && !loading && !error && referralCount === 0 && (
        <div className="hud-card p-3 text-center text-[0.7rem] text-muted-foreground">
          Friends must open your link{" "}
          <span className="text-foreground">inside Telegram</span>, then play a few
          merges so they verify.
        </div>
      )}

      {/* Recent recruits — MUST stay when length > 0 */}
      {authenticated && recruits.length > 0 && (
        <div className="holo-panel p-4">
          <h3 className="mb-2 hud-title">
            <Users className="h-4 w-4 text-neon-cyan" /> Recent Recruits
          </h3>
          <div className="space-y-1.5">
            {recruits.map((r, i) => (
              <div
                key={`${r.name}-${r.joinedAt}-${i}`}
                className="flex items-center justify-between gap-2 hud-card p-3"
              >
                <span className="truncate text-xs font-bold text-foreground">
                  {r.name}
                </span>
                <span
                  className={`shrink-0 hud-chip ${
                    r.qualified
                      ? "bg-secondary text-neon-green"
                      : "bg-secondary text-muted-foreground"
                  }`}
                >
                  {r.qualified ? "Verified" : "Pending"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty list hint when people joined but API returned none (shouldn't happen) */}
      {authenticated &&
        !loading &&
        !error &&
        rawCount > 0 &&
        recruits.length === 0 && (
          <div className="hud-card p-3 text-center text-[0.7rem] text-muted-foreground">
            {rawCount} joined — open Refresh if the list is empty.
          </div>
        )}

      {/* Milestones */}
      <div className="holo-panel p-4">
        <h3 className="mb-2 hud-title">
          <Users className="h-4 w-4 text-neon-amber" /> Milestone Rewards
        </h3>

        {!authenticated ? (
          <div className="hud-card p-3 text-center text-xs text-muted-foreground">
            Sign in through Telegram to earn milestone rewards.
          </div>
        ) : loading ? (
          <div className="hud-card p-3 text-center text-xs text-muted-foreground">
            Loading milestones…
          </div>
        ) : (
          <div className="space-y-2">
            {milestones.map((m) => {
              const progress = Math.min(1, referralCount / m.threshold);
              return (
                <div
                  key={m.threshold}
                  className={`hud-card p-3 ${
                    m.claimed
                      ? "border-border bg-background opacity-70"
                      : m.claimable
                        ? "hud-card-active"
                        : "border-border bg-background"
                  }`}
                >
                  <div className="mb-1 flex flex-wrap items-center justify-between gap-1">
                    <div className="text-sm font-mono font-black text-foreground">
                      {m.threshold} verified recruit
                      {m.threshold === 1 ? "" : "s"}
                    </div>
                    <div className="hud-label">
                      +{m.reward.glory}★ ·{" "}
                      <span className="text-destructive">
                        +{m.reward.wardog}
                      </span>
                      /
                      <span className="text-neon-cyan">
                        {m.reward.warcat}
                      </span>
                    </div>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${progress * 100}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between">
                    <div className="hud-label">
                      {Math.min(referralCount, m.threshold)} / {m.threshold}
                    </div>
                    {m.claimable && (
                      <button
                        type="button"
                        onClick={() => void doClaim(m.threshold)}
                        disabled={busy === m.threshold}
                        className="min-h-11 rounded-lg cta-amber hit-cta px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider disabled:opacity-50"
                      >
                        {busy === m.threshold ? "Claiming…" : "Claim"}
                      </button>
                    )}
                    {m.claimed && (
                      <span className="text-[0.65rem] font-bold uppercase tracking-wider text-neon-green">
                        Claimed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
