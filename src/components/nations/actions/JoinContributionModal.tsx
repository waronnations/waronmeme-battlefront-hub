// src/components/nations/actions/JoinContributionModal.tsx
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";

export function JoinContributionModal({
  showJoinContributionModal,
  setShowJoinContributionModal,
  pendingContribution,
  confirmJoinWithContribution,
  joiningId,
}: {
  showJoinContributionModal: boolean;
  setShowJoinContributionModal: (v: boolean) => void;
  pendingContribution: { wardog: number; warcat: number };
  confirmJoinWithContribution: () => void;
  joiningId: number | null;
}) {
  return (
    <TacticalModal
      open={showJoinContributionModal}
      onClose={() => setShowJoinContributionModal(false)}
      title="Protected Nation"
      subtitle={"This nation is under 24h protection. To join you must contribute to the vault:"}
      badge="Nation treasury"
      tone="green"
      layer="top"
      align="center"
    >
            <div className="mt-4 rounded-xl border border-neon-green/30 bg-secondary/60 px-4 py-3 text-center">
              <div className="text-lg font-black text-neon-green">
                {pendingContribution.wardog} WARDOG + {pendingContribution.warcat} WARCAT
              </div>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Leaving later will mark you as a Traitor. You can redeem by
              paying the leader&apos;s price or waiting 7 days (reduced rewards).
            </p>
            <div className="mt-4 flex gap-2">
              <TacticalCTA
                variant="ghost"
                buzz="light"
                className="flex-1 text-xs"
                onClick={() => setShowJoinContributionModal(false)}
              >
                Decline
              </TacticalCTA>
              <TacticalCTA
                variant="deploy"
                className="flex-1 text-xs"
                onClick={confirmJoinWithContribution}
                disabled={joiningId !== null}
              >
                {joiningId !== null ? "Joining..." : "Accept & Join"}
              </TacticalCTA>
            </div>
    </TacticalModal>
  );
}
