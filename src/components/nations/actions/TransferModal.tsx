// src/components/nations/actions/TransferModal.tsx
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";
import { cn } from "@/lib/utils";
import { TraitorBadge, OfficerBadge } from "../badges";
import type { NationMember } from "../use-nations-panel";

export function TransferModal({
  showTransferModal,
  setShowTransferModal,
  members,
  selectedTransferId,
  setSelectedTransferId,
  transferring,
  handleTransfer,
}: {
  showTransferModal: boolean;
  setShowTransferModal: (v: boolean) => void;
  members: NationMember[];
  selectedTransferId: number | null;
  setSelectedTransferId: (v: number | null) => void;
  transferring: boolean;
  handleTransfer: () => Promise<void>;
}) {
  return (
    <TacticalModal
      open={showTransferModal}
      onClose={() => setShowTransferModal(false)}
      title="Transfer Leadership"
      subtitle={"Choose a member to become the new Leader."}
      badge="Transfer order"
      tone="cyan"
      layer="base"
      align="center"
    >
            <div className="mt-4 space-y-2">
              {members.length === 0 ? (
                <div className="py-6 text-center text-sm text-muted-foreground">
                  No other members
                </div>
              ) : (
                members.map((m) => (
                  <button
                    key={m.userId}
                    onClick={() => setSelectedTransferId(m.userId)}
                    className={cn(
                      "flex min-h-11 w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left",
                      selectedTransferId === m.userId
                        ? "border-neon-cyan bg-secondary"
                        : "border-border bg-secondary hover:border-neon-cyan/50",
                    )}
                  >
                    <span className="text-sm font-medium text-foreground">
                      {m.username
                        ? `@${m.username}`
                        : m.firstName || `#${m.userId}`}
                    </span>
                    <div className="flex items-center gap-1">
                      {m.isTraitor && <TraitorBadge />}
                      {m.role === "officer" && <OfficerBadge />}
                    </div>
                  </button>
                ))
              )}
            </div>
            <div className="mt-4 flex gap-2">
              <TacticalCTA
                variant="ghost"
                buzz="light"
                className="flex-1 text-xs"
                onClick={() => {
                  setShowTransferModal(false);
                  setSelectedTransferId(null);
                }}
              >
                Cancel
              </TacticalCTA>
              <TacticalCTA
                variant="deploy"
                className="flex-1 text-xs"
                onClick={handleTransfer}
                disabled={!selectedTransferId || transferring}
              >
                {transferring ? "Transferring..." : "Transfer"}
              </TacticalCTA>
            </div>
    </TacticalModal>
  );
}
