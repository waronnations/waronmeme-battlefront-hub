// src/components/nations/actions/DonateModal.tsx
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";
import type { NationDetails } from "../use-nations-panel";

export function DonateModal({
  showDonateModal,
  setShowDonateModal,
  selected,
  donateWardog,
  setDonateWardog,
  donateWarcat,
  setDonateWarcat,
  donating,
  handleDonate,
}: {
  showDonateModal: boolean;
  setShowDonateModal: (v: boolean) => void;
  selected: NationDetails | null;
  donateWardog: string;
  setDonateWardog: (v: string) => void;
  donateWarcat: string;
  setDonateWarcat: (v: string) => void;
  donating: boolean;
  handleDonate: () => Promise<void>;
}) {
  return (
    <TacticalModal
      open={showDonateModal && !!selected}
      onClose={() => setShowDonateModal(false)}
      title="Donate to Vault"
      subtitle={selected ? `Support ${selected.name}` : undefined}
      badge="Nation treasury"
      tone="green"
      layer="base"
      align="center"
    >
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-xs text-muted-foreground">WARDOG</label>
                <input
                  type="number"
                  value={donateWardog}
                  onChange={(e) => setDonateWardog(e.target.value)}
                  min="0"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-border bg-secondary min-h-11 px-4 py-2.5 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  placeholder="0"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground">WARCAT</label>
                <input
                  type="number"
                  value={donateWarcat}
                  onChange={(e) => setDonateWarcat(e.target.value)}
                  min="0"
                  step="0.1"
                  className="mt-1 w-full rounded-xl border border-border bg-secondary min-h-11 px-4 py-2.5 text-foreground focus:border-neon-cyan/50 focus:outline-none"
                  placeholder="0"
                />
              </div>
            </div>
            <div className="mt-4 flex gap-2">
              <TacticalCTA
                variant="ghost"
                buzz="light"
                className="flex-1 text-xs"
                onClick={() => setShowDonateModal(false)}
              >
                Cancel
              </TacticalCTA>
              <TacticalCTA
                variant="deploy"
                className="flex-1 text-xs"
                onClick={handleDonate}
                disabled={donating}
              >
                {donating ? "Donating..." : "Donate"}
              </TacticalCTA>
            </div>
    </TacticalModal>
  );
}
