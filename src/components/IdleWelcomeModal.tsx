// src/components/IdleWelcomeModal.tsx
import { useEffect, useState } from "react";
import { Moon, Check, Radio } from "lucide-react";
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";
import type { IdleReward } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";

interface Props {
  reward: IdleReward | null;
  onClose: () => void;
}

function fmtAway(minutes: number): string {
  if (minutes < 60) return `${minutes}m`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
}

export function IdleWelcomeModal({ reward, onClose }: Props) {
  const [collected, setCollected] = useState(false);

  // Reset animation state whenever a new idle reward appears
  useEffect(() => {
    setCollected(false);
  }, [reward]);

  const handleCollect = () => {
    haptic("medium");
    if (!collected) {
      // Grant happens in parent onClose (claimIdleReward)
      setCollected(true);
      setTimeout(() => onClose(), 700);
    } else {
      onClose();
    }
  };

  const tile = (label: string, value: string, tone: string) => (
    <div className="rounded-xl border border-border bg-secondary/60 p-3 text-center">
      <div className="text-[0.6rem] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-black ${tone}`}>{value}</div>
    </div>
  );

  return (
    <TacticalModal
      open={!!reward}
      tone="green"
      badge="Base report"
      badgeIcon={Radio}
      icon={collected ? <Check className="h-7 w-7" /> : <Moon className="h-7 w-7" />}
      title={collected ? "Collected!" : "Welcome back, Commander"}
      subtitle={collected ? "Your rewards are secured" : reward ? `Your pack held the line for ${fmtAway(reward.minutes)}` : undefined}
      sound={collected ? "reward" : "transmission"}
      align="center"
      footer={
        <TacticalCTA variant={collected ? "deploy" : "amber"} buzz="none" onClick={handleCollect}>
          {collected ? "Tap to continue" : "Collect"}
        </TacticalCTA>
      }
    >
      {reward && !collected && (
        <div className="mt-4 grid grid-cols-2 gap-2.5">
          {(reward.glory ?? 0) > 0 && tile("Glory", `+${(reward.glory ?? 0).toLocaleString()}`, "neon-text-amber")}
          {(reward.energy ?? 0) > 0 && tile("Energy", `+${reward.energy}⚡`, "neon-text-cyan")}
          {reward.wardog > 0 && tile("$WARDOG", `+${reward.wardog.toFixed(3)}`, "text-foreground")}
          {reward.warcat > 0 && tile("$WARCAT", `+${reward.warcat.toFixed(3)}`, "text-foreground")}
        </div>
      )}
    </TacticalModal>
  );
}
