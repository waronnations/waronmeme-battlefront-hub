// src/components/nations/detail/VaultSection.tsx
import { Coins, Shield } from "lucide-react";
import type { NationDetails } from "../use-nations-panel";

export function VaultSection({
  selected,
  setShowDonateModal,
}: {
  selected: NationDetails;
  setShowDonateModal: (v: boolean) => void;
}) {
  return (
    <div className="holo-panel p-4 mt-4">
      <div className="flex items-center justify-between">
        <div className="hud-title flex items-center gap-2 text-neon-amber">
          <Coins className="h-4 w-4" />
          Nation Vault
        </div>
        {selected.isMember && (
          <button
            onClick={() => setShowDonateModal(true)}
            className="hit-cta cta-amber px-3"
          >
            Donate
          </button>
        )}
      </div>
      <div className="mt-2 flex gap-4 text-sm">
        <div>
          <span className="text-muted-foreground">WARDOG:</span>{" "}
          <span className="font-mono font-black neon-text-amber">
            {Number(selected.vaultWardog || 0).toFixed(2)}
          </span>
        </div>
        <div>
          <span className="text-muted-foreground">WARCAT:</span>{" "}
          <span className="font-mono font-black neon-text-amber">
            {Number(selected.vaultWarcat || 0).toFixed(2)}
          </span>
        </div>
      </div>
    </div>
  );
}

export function ProtectionStatus({ selected }: { selected: NationDetails }) {
  if (!selected.isProtected) return null;
  return (
    <div className="hud-card p-3 mt-3 border-neon-green/30">
      <div className="flex items-center gap-2 text-sm font-bold text-neon-green">
        <Shield className="h-4 w-4" />
        Protected (24h)
      </div>
      {selected.protectionExpiresAt && (
        <div className="mt-0.5 text-xs text-muted-foreground">
          Until{" "}
          {new Date(selected.protectionExpiresAt).toLocaleString()}
        </div>
      )}
      <div className="mt-1 text-xs text-muted-foreground">
        Join contribution: {selected.joinContributionWardog} WARDOG
        + {selected.joinContributionWarcat} WARCAT
      </div>
    </div>
  );
}

export function LeaderProtectionControls({
  selected,
  activatingProtection,
  handleActivateProtection,
  setShowRedemptionModal,
  protectionCost,
}: {
  selected: NationDetails;
  activatingProtection: boolean;
  handleActivateProtection: () => Promise<void>;
  setShowRedemptionModal: (v: boolean) => void;
  protectionCost: { wardog: number; warcat: number };
}) {
  if (selected.myRole !== "leader") return null;
  return (
    <div className="mt-3 space-y-2">
      {!selected.isProtected && (
        <button
          onClick={() => void handleActivateProtection()}
          disabled={activatingProtection}
          className="min-h-11 min-w-11 flex w-full items-center justify-center gap-2 rounded-xl border border-neon-green/40 bg-neon-green/30 py-2.5 text-sm font-bold text-neon-green disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {activatingProtection
            ? "Activating..."
            : `Activate 24h Protection (${protectionCost.wardog}+${protectionCost.warcat} from vault)`}
        </button>
      )}
      <button
        onClick={() => setShowRedemptionModal(true)}
        className="min-h-11 min-w-11 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent py-2.5 text-sm font-bold text-foreground"
      >
        Set Traitor Redemption Price
        <span className="text-xs text-muted-foreground">
          ({selected.redemptionPriceWardog}/
          {selected.redemptionPriceWarcat})
        </span>
      </button>
    </div>
  );
}
