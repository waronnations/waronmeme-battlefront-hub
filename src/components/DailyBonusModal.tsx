// src/components/DailyBonusModal.tsx
import { Gift, Package } from "lucide-react";
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";

export function DailyBonusModal({
  open,
  streak,
  onClaim,
  onClose,
}: {
  open: boolean;
  streak: number;
  onClaim: () => void;
  onClose: () => void;
}) {
  // Matches game-state.ts: 100 + streak * 25 glory, 30 energy
  const glory = 100 + streak * 25;
  const energy = 30;

  return (
    <TacticalModal
      open={open}
      onClose={onClose}
      tone="amber"
      badge="Supply drop"
      badgeIcon={Package}
      icon={<Gift className="h-8 w-8" />}
      title="Field rations"
      subtitle={`Day ${streak + 1} of your daily streak`}
      align="center"
      footer={
        <TacticalCTA variant="amber" buzz="medium" onClick={onClaim}>
          Claim & deploy
        </TacticalCTA>
      }
    >
      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl border border-border bg-secondary/60 p-3">
          <div className="text-xl font-black neon-text-amber">+{glory.toLocaleString()}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Glory</div>
        </div>
        <div className="rounded-xl border border-border bg-secondary/60 p-3">
          <div className="text-xl font-black neon-text-cyan">+{energy}</div>
          <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">Energy</div>
        </div>
      </div>
    </TacticalModal>
  );
}
