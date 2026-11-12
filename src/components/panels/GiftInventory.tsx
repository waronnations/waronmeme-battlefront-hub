// src/components/panels/GiftInventory.tsx
import { useState } from "react";
import { toast } from "sonner";
import { Gift } from "lucide-react";
import type { GameState } from "@/lib/game-state";
import { GIFT_BOXES, type GiftBoxId } from "@/lib/constants/gifts";
import { ClaimBurst } from "@/components/game/ClaimBurst";
import { haptic } from "@/lib/telegram";

export function GiftInventory({
  state,
  onOpen,
}: {
  state: GameState;
  onOpen: (giftId: GiftBoxId) => Promise<void> | void;
}) {
  const [burst, setBurst] = useState<GiftBoxId | null>(null);
  const [busy, setBusy] = useState<GiftBoxId | null>(null);

  const boxes = state.giftBoxes ?? {};
  const entries = (Object.keys(GIFT_BOXES) as GiftBoxId[]).filter(
    (id) => (boxes[id] ?? 0) > 0,
  );

  if (entries.length === 0) {
    return (
      <div className="holo-panel p-4 text-center">
        <Gift className="mx-auto mb-2 h-6 w-6 text-muted-foreground" />
        <div className="text-sm text-muted-foreground">No supply drops yet</div>
        <div className="mt-1 text-[0.65rem] text-muted-foreground">
          Complete Daily Ops or buy in Shop
        </div>
      </div>
    );
  }

  return (
    <div className="holo-panel p-4 space-y-2">
      <h3 className="px-1 hud-title">
        <Gift className="h-4 w-4 text-neon-amber" /> Your Supply Drops
      </h3>

      {entries.map((id) => {
        const def = GIFT_BOXES[id];
        const count = boxes[id] ?? 0;

        return (
          <div
            key={id}
            className="flex items-center gap-3 holo-panel p-4"
          >
            <div className="grid h-12 w-12 place-items-center overflow-hidden rounded-xl bg-background/40">
              <img
                src={def.closedImg}
                alt={def.name}
                className="h-10 w-10 object-contain"
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold text-foreground">{def.name}</div>
              <div className="text-xs text-muted-foreground">
                ×{count} · {def.desc}
              </div>
            </div>

            <button
              disabled={!!busy}
              onClick={async () => {
                if (busy) return;
                setBusy(id);
                try {
                  await onOpen(id);
                  haptic("heavy");
                  setBurst(id);
                  toast.success(`${def.name} opened!`);
                } catch {
                  toast.error("Failed to open");
                } finally {
                  setBusy(null);
                }
              }}
              className="min-h-11 shrink-0 rounded-xl cta-amber hit-cta px-3 py-1.5 text-[0.65rem] font-bold uppercase tracking-wider disabled:opacity-50"
            >
              {busy === id ? "…" : "Open"}
            </button>
          </div>
        );
      })}

      {burst && (
        <ClaimBurst giftId={burst} onComplete={() => setBurst(null)} />
      )}
    </div>
  );
}
