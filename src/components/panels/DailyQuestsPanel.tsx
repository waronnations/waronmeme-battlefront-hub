// src/components/panels/DailyQuestsPanel.tsx
// Tactical daily operations and reward progress
import { useState } from "react";
import { toast } from "sonner";
import { Check, Crosshair } from "lucide-react";
import type { GameState } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";
import { RewardLine } from "./RewardLine";
import { ClaimBurst } from "@/components/game/ClaimBurst";
import { GIFT_CLOSED_VARIANTS } from "@/lib/constants/gifts";
import type { GiftBoxId } from "@/lib/constants/gifts";

function pickClosedImg(id: GiftBoxId = "common") {
  const variants = GIFT_CLOSED_VARIANTS[id] || GIFT_CLOSED_VARIANTS.common;
  return variants[Math.floor(Math.random() * variants.length)];
}

export function DailyQuestsPanel({
  state,
  onClaim,
}: {
  state: GameState;
  onClaim: (id: string) => void | Promise<void>;
}) {
  const [burstGift, setBurstGift] = useState<GiftBoxId | null>(null);

  return (
    <div className="holo-panel p-4 space-y-2">
      <div className="flex items-center justify-between px-1">
        <h3 className="hud-title">
          <Crosshair className="h-4 w-4 text-neon-cyan" /> Daily Ops
        </h3>
        <div className="hud-label">
          Resets at midnight
        </div>
      </div>

      {!(state.dailyQuests ?? []).length && (
        <div className="holo-panel p-4 text-center text-sm text-muted-foreground">
          New daily ops incoming — check back shortly.
        </div>
      )}

      {(state.dailyQuests ?? []).map((q) => {
        const pct = Math.min(100, (q.progress / q.target) * 100);
        const ready = q.progress >= q.target && !q.claimed;
        const closedSrc = pickClosedImg("common");

        return (
          <div
            key={q.id}
            className={`hud-card p-3 ${
              q.claimed
                ? "border-border bg-background/60 opacity-80"
                : "border-border bg-background"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <div
                className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl ${
                  q.claimed
                    ? "bg-secondary"
                    : ready
                      ? "bg-secondary ring-1 ring-neon-cyan/40"
                      : "bg-secondary"
                }`}
              >
                {q.claimed ? (
                  <Check className="h-5 w-5 text-neon-green" />
                ) : (
                  <img
                    src={closedSrc}
                    alt="Ops crate"
                    className="h-8 w-8 object-contain"
                  />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-bold text-foreground">
                  {q.title}
                </div>
                <div className="truncate text-xs text-muted-foreground">{q.desc}</div>
                <RewardLine
                  glory={q.reward}
                  wardog={q.wardog}
                  warcat={q.warcat}
                  energy={q.energy}
                />
              </div>

              <button
                disabled={!ready && !q.claimed}
                onClick={async () => {
                  if (!ready) return;
                  try {
                    await onClaim(q.id);
                    haptic("medium");
                    setBurstGift("common");
                    toast.success("Daily ops claimed — supply drop incoming!");
                  } catch {
                    /* handled upstream */
                  }
                }}
                className={`min-h-11 shrink-0 rounded-xl px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                  q.claimed
                    ? "cursor-default bg-secondary text-neon-green"
                    : ready
                      ? "cta-amber hit-cta"
                      : "cursor-not-allowed bg-secondary text-muted-foreground"
                }`}
              >
                {q.claimed
                  ? "Claimed"
                  : ready
                    ? "Claim"
                    : `${q.progress}/${q.target}`}
              </button>
            </div>

            <div className="mt-2 progress-track">
              <div
                className={`progress-fill ${
                  q.claimed ? "bg-neon-green" : "bg-neon-cyan"
                }`}
                style={{ width: `${pct}%` }}
              />
            </div>
          </div>
        );
      })}

      {burstGift && (
        <ClaimBurst
          giftId={burstGift}
          onComplete={() => setBurstGift(null)}
        />
      )}
    </div>
  );
}
