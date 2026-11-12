// src/components/nations/detail/LeaderCard.tsx
import { Crown } from "lucide-react";
import { TraitorBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function LeaderCard({ selected }: { selected: NationDetails }) {
  if (!selected.leader) return null;
  return (
    <div className="mt-3 hud-card p-3">
      <div className="hud-title">
        Leader
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-sm font-bold text-foreground">
        <Crown className="h-3.5 w-3.5 text-neon-amber" />
        {selected.leader.username
          ? `@${selected.leader.username}`
          : selected.leader.firstName ||
            `#${selected.leader.userId}`}
        {selected.leader.isTraitor && <TraitorBadge />}
      </div>
    </div>
  );
}
