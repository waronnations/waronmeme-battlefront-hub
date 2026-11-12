// src/components/nations/actions/RedemptionModal.tsx
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";

export function RedemptionModal({
  showRedemptionModal,
  setShowRedemptionModal,
  redemptionWardog,
  setRedemptionWardog,
  redemptionWarcat,
  setRedemptionWarcat,
  settingRedemption,
  handleSetRedemptionPrice,
}: {
  showRedemptionModal: boolean;
  setShowRedemptionModal: (v: boolean) => void;
  redemptionWardog: string;
  setRedemptionWardog: (v: string) => void;
  redemptionWarcat: string;
  setRedemptionWarcat: (v: string) => void;
  settingRedemption: boolean;
  handleSetRedemptionPrice: () => Promise<void>;
}) {
  return (
    <TacticalModal
      open={showRedemptionModal}
      onClose={() => setShowRedemptionModal(false)}
      title="Traitor Redemption Price"
      subtitle={"Price a traitor must pay to clear their status (goes to vault). Max 200 each."}
      badge="Redemption order"
      tone="amber"
      layer="top"
      align="center"
    >
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">WARDOG</label>
                <input
                  type="number"
                  value={redemptionWardog}
                  onChange={(e) => setRedemptionWardog(e.target.value)}
                  min="0"
                  max="200"
                  step="1"
                  className="mt-1 w-full rounded-xl border border-border bg-secondary min-h-11 px-4 py-2.5 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">WARCAT</label>
                <input
                  type="number"
                  value={redemptionWarcat}
                  onChange={(e) => setRedemptionWarcat(e.target.value)}
                  min="0"
                  max="200"
                  step="1"
                  className="mt-1 w-full rounded-xl border border-border bg-secondary min-h-11 px-4 py-2.5 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <TacticalCTA
                variant="ghost"
                buzz="light"
                className="flex-1 text-xs"
                onClick={() => setShowRedemptionModal(false)}
              >
                Cancel
              </TacticalCTA>
              <TacticalCTA
                variant="amber"
                className="flex-1 text-xs"
                onClick={handleSetRedemptionPrice}
                disabled={settingRedemption}
              >
                {settingRedemption ? "Saving..." : "Save"}
              </TacticalCTA>
            </div>
    </TacticalModal>
  );
}
