// src/components/ConquestModal.tsx
import { Crown, Flame, Trophy } from "lucide-react";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
} from "@/lib/constants";
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";

interface Props {
  open: boolean;
  side: "dog" | "cat";
  hybridCount: number;
  onMassSacrifice: () => void;
}

export function ConquestModal({
  open,
  side,
  hybridCount,
  onMassSacrifice,
}: Props) {
  const sideName = side === "dog" ? "WARDOG" : "WARCAT";

  return (
    <TacticalModal
      open={open}
      tone="amber"
      badge="Conquest event"
      badgeIcon={Trophy}
      icon={<Crown className="h-8 w-8" />}
      title="You won the war!"
      sound="victory"
      hapticOnOpen="success"
      layer="top"
      align="center"
      footer={
        <>
          <TacticalCTA variant="danger" onClick={onMassSacrifice} className="flex-col gap-0.5 py-3">
            <span className="flex items-center gap-2 text-base">
              <Flame className="h-5 w-5" /> Mass sacrifice hybrids
            </span>
            <span className="text-[11px] font-bold normal-case tracking-normal opacity-90">
              +{HYBRID_SACRIFICE_GLORY} Glory × {hybridCount} × 1.5 · +{HYBRID_SACRIFICE_WARDOG} $WARDOG / $WARCAT each
            </span>
          </TacticalCTA>
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            This clears all hybrids on the {sideName} side and awards the full conquest bonus. Remaining normal units stay on the board.
          </p>
        </>
      }
    >
      <p className="mt-3 text-center text-sm leading-relaxed text-foreground">
        Your hybrids have conquered the <span className="font-bold neon-text-amber">{sideName}</span> board ({hybridCount} hybrids).
        <br />
        <span className="text-muted-foreground">Mass sacrifice them now to claim the victory spoils.</span>
      </p>
    </TacticalModal>
  );
}
