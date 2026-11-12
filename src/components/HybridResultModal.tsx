// src/components/HybridResultModal.tsx
import { ArrowLeft, Sparkles } from "lucide-react";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
} from "@/lib/constants";
import { TacticalCTA, TacticalChoice, TacticalModal } from "@/components/ui/TacticalModal";

interface Props {
  open: boolean;
  imageUrl: string | null;
  onResolve: (choice: "keep" | "mint" | "sacrifice") => void;
  onBack: () => void;
}

export function HybridResultModal({
  open,
  imageUrl,
  onResolve,
  onBack,
}: Props) {
  return (
    <TacticalModal
      open={open && !!imageUrl}
      tone="green"
      badge="Trophy art ready"
      badgeIcon={Sparkles}
      title="Your hybrid look"
      subtitle="Saved as unit art in-game — not an on-chain NFT."
      sound="victory"
      hapticOnOpen="success"
      layer="max"
      align="center"
      footer={
        <>
          <TacticalChoice variant="deploy" onClick={() => onResolve("keep")} label="Keep on board" detail="Place this hybrid unit with its trophy art" />
          <TacticalChoice variant="ghost" buzz="medium" onClick={() => onResolve("mint")} label="Save trophy + keep unit" detail="Same as keep — chain mint coming later" />
          <TacticalChoice
            variant="danger"
            onClick={() => onResolve("sacrifice")}
            label="Sacrifice instead"
            detail={`+${HYBRID_SACRIFICE_GLORY} Glory · +${HYBRID_SACRIFICE_WARDOG} $WARDOG · +${HYBRID_SACRIFICE_WARCAT} $WARCAT`}
          />
          <TacticalCTA variant="ghost" buzz="light" onClick={onBack} className="text-xs">
            <ArrowLeft className="h-4 w-4" /> Back
          </TacticalCTA>
        </>
      }
    >
      {imageUrl && (
        <div className="mx-auto mt-4 flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl border-2 border-neon-green/60 bg-secondary">
          <img src={imageUrl} alt="Hybrid trophy art" className="h-full w-full object-cover" />
        </div>
      )}
    </TacticalModal>
  );
}
