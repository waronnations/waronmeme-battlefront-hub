// src/components/nations/NationDetail.tsx
import { Globe2 } from "lucide-react";
import { TacticalModal } from "@/components/ui/TacticalModal";
import type { NationDetails, NationHistoryRow, PayToken } from "./use-nations-panel";
import type { NationBuffId } from "@/lib/constants";
import { DetailHeader } from "./detail/DetailHeader";
import {
  VaultSection,
  ProtectionStatus,
  LeaderProtectionControls,
} from "./detail/VaultSection";
import { BuffsSection } from "./detail/BuffsSection";
import { LeaderCard } from "./detail/LeaderCard";
import { StatsGrid } from "./detail/StatsGrid";
import { MembersList } from "./detail/MembersList";
import { HistoryList } from "./detail/HistoryList";
import { ActionFooter } from "./detail/ActionFooter";

export function NationDetail({
  selected,
  setSelected,
  detailsLoading,
  canManageBuffs,
  activatingBuff,
  activateBuff,
  isLeader,
  promoting,
  demoting,
  handlePromote,
  handleDemote,
  handleJoin,
  joiningId,
  handleBuy,
  buying,
  setShowDonateModal,
  activatingProtection,
  handleActivateProtection,
  setShowRedemptionModal,
  protectionCost,
  history = [],
  historyLoading = false,
  kicking = null,
  handleKick,
}: {
  selected: NationDetails | null;
  setSelected: (v: NationDetails | null) => void;
  detailsLoading: boolean;
  canManageBuffs: boolean;
  activatingBuff: string | null;
  activateBuff: (buffId: NationBuffId) => Promise<void>;
  isLeader: boolean;
  promoting: number | null;
  demoting: number | null;
  handlePromote: (toUserId: number) => Promise<void>;
  handleDemote: (toUserId: number) => Promise<void>;
  handleJoin: (nationId: number) => void;
  joiningId: number | null;
  handleBuy: (nationId: number, payWith: PayToken) => Promise<void>;
  buying: boolean;
  setShowDonateModal: (v: boolean) => void;
  activatingProtection: boolean;
  handleActivateProtection: () => Promise<void>;
  setShowRedemptionModal: (v: boolean) => void;
  protectionCost: { wardog: number; warcat: number };
  history?: NationHistoryRow[];
  historyLoading?: boolean;
  kicking?: number | null;
  handleKick?: (targetUserId: number) => Promise<void>;
}) {
  return (
    <TacticalModal
      open={!!selected || detailsLoading}
      onClose={() => setSelected(null)}
      title="Nation intel"
      badge="Nation intel"
      badgeIcon={Globe2}
      tone="cyan"
      sound="none"
      hapticOnOpen="light"
      className="max-h-[85dvh]"
    >
            {detailsLoading || !selected ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                Loading...
              </div>
            ) : (
              <>
                <DetailHeader selected={selected} setSelected={setSelected} />

                <VaultSection
                  selected={selected}
                  setShowDonateModal={setShowDonateModal}
                />

                <ProtectionStatus selected={selected} />

                <LeaderProtectionControls
                  selected={selected}
                  activatingProtection={activatingProtection}
                  handleActivateProtection={handleActivateProtection}
                  setShowRedemptionModal={setShowRedemptionModal}
                  protectionCost={protectionCost}
                />

                <BuffsSection
                  canManageBuffs={canManageBuffs}
                  activatingBuff={activatingBuff}
                  activateBuff={activateBuff}
                />

                <LeaderCard selected={selected} />

                <StatsGrid selected={selected} />

                <MembersList
                  selected={selected}
                  isLeader={isLeader}
                  promoting={promoting}
                  demoting={demoting}
                  handlePromote={handlePromote}
                  handleDemote={handleDemote}
                  kicking={kicking}
                  handleKick={handleKick}
                />

                <HistoryList history={history} historyLoading={historyLoading} />

                <ActionFooter
                  selected={selected}
                  handleJoin={handleJoin}
                  joiningId={joiningId}
                  handleBuy={handleBuy}
                  buying={buying}
                />
              </>
            )}
    </TacticalModal>
  );
}
