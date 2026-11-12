// src/components/HybridModal.tsx
import { Dna } from "lucide-react";
import {
  HYBRID_SACRIFICE_GLORY,
  HYBRID_SACRIFICE_WARDOG,
  HYBRID_SACRIFICE_WARCAT,
  HYBRID_KEEP_GLORY,
} from "@/lib/constants";
import { TacticalChoice, TacticalModal } from "@/components/ui/TacticalModal";

interface Props {
  open: boolean;
  onResolve: (choice: "sacrifice" | "keep" | "generate") => void;
}

export function HybridModal({ open, onResolve }: Props) {
  return (
    <TacticalModal
      open={open}
      tone="amber"
      badge="Hybrid clash"
      badgeIcon={Dna}
      icon={<Dna className="h-8 w-8" />}
      title="Legendary hybrid born"
      subtitle="A WARDOG and WARCAT fused into a Tier-6 hybrid. Choose its fate — this is an in-game unit, not an on-chain NFT yet."
      sound="victory"
      hapticOnOpen="success"
      layer="top"
      align="center"
      footer={
        <>
          <TacticalChoice
            variant="danger"
            onClick={() => onResolve("sacrifice")}
            label="Sacrifice"
            detail={`+${HYBRID_SACRIFICE_GLORY} Glory · +${HYBRID_SACRIFICE_WARDOG} $WARDOG · +${HYBRID_SACRIFICE_WARCAT} $WARCAT`}
          />
          <TacticalChoice
            variant="amber"
            onClick={() => onResolve("keep")}
            label="Keep as unit"
            detail={`+${HYBRID_KEEP_GLORY} Glory · Place hybrid on the battlefield`}
          />
          <TacticalChoice
            variant="ghost"
            buzz="medium"
            onClick={() => onResolve("generate")}
            label="Generate unique art"
            detail="Optional trophy skin for this hybrid · paid art (when live)"
          />
          <p className="text-center text-[10px] leading-relaxed text-muted-foreground">
            Art is a cosmetic trophy saved to your account. Chain mint / GetGems listing is not available yet.
          </p>
        </>
      }
    />
  );
}
