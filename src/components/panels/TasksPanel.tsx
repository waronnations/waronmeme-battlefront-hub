// src/components/panels/TasksPanel.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
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

export function TasksPanel({
  state,
  onClaim,
}: {
  state: GameState;
  onClaim: (id: string) => void | Promise<void>;
}) {
  const [burstGift, setBurstGift] = useState<GiftBoxId | null>(null);

  return (
    <div className="holo-panel p-4 space-y-2">
      {!(state.tasks ?? []).length && (
        <div className="holo-panel p-4 text-center text-sm text-muted-foreground">
          All missions complete, soldier. Stand by for new orders.
        </div>
      )}

      {(state.tasks ?? []).map((t) => {
        const claimed = !!t.claimed;
        const canClaim = !!t.done && !claimed;
        const closedSrc = pickClosedImg("common");

        return (
          <div
            key={t.id}
            className={`flex items-center gap-2.5 holo-panel p-4 ${
              claimed ? "opacity-70" : ""
            }`}
          >
            <div
              className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-xl ${
                claimed
                  ? "bg-neon-cyan/10"
                  : t.done
                    ? "bg-neon-cyan/15 ring-1 ring-neon-cyan/50"
                    : "bg-secondary"
              }`}
            >
              {claimed || t.done ? (
                <Check
                  className={`h-5 w-5 ${claimed ? "text-neon-green" : "text-foreground"}`}
                />
              ) : (
                <img
                  src={closedSrc}
                  alt="Mission crate"
                  className="h-8 w-8 object-contain"
                />
              )}
            </div>

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-bold text-foreground">
                {t.title}
              </div>
              <div className="truncate text-xs text-muted-foreground">{t.desc}</div>
              <RewardLine glory={t.reward} wardog={t.wardog} warcat={t.warcat} />
            </div>

            <button
              disabled={!canClaim}
              onClick={async () => {
                if (!canClaim) return;
                try {
                  await onClaim(t.id);
                  haptic("medium");
                  setBurstGift("common");
                  toast.success(
                    `+${t.reward} Glory${t.wardog ? ` · +${t.wardog} $WARDOG` : ""}${
                      t.warcat ? ` · +${t.warcat} $WARCAT` : ""
                    }`,
                  );
                } catch {
                  // error already handled inside onClaim
                }
              }}
              className={`min-h-11 shrink-0 rounded-xl px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider ${
                claimed
                  ? "cursor-default bg-neon-cyan/10 text-neon-green"
                  : canClaim
                    ? "cta-amber hit-cta"
                    : "cursor-not-allowed bg-secondary text-muted-foreground"
              }`}
            >
              {claimed ? "Claimed" : t.done ? "Claim" : "Locked"}
            </button>
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
