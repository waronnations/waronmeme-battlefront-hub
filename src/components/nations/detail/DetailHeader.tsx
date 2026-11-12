// src/components/nations/detail/DetailHeader.tsx
import { getReputationTier } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TraitorBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function DetailHeader({
  selected,
  setSelected,
}: {
  selected: NationDetails;
  setSelected: (v: NationDetails | null) => void;
}) {
  return (
    <div className="holo-panel holo-scan p-4 mt-3 flex items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        <div className="grid h-14 w-14 place-items-center hud-card text-3xl">
          {selected.emblem || "🏳️"}
        </div>
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="hud-title text-lg">
              {selected.name}
            </h3>
            {selected.leader?.isTraitor && <TraitorBadge />}
          </div>
          <div className="text-xs text-muted-foreground">
            [{selected.tag}] · {selected.memberCount} members
          </div>
          {typeof selected.reputation === "number" && (
            <div
              className={cn(
                "hud-chip mt-1.5",
                getReputationTier(selected.reputation).bg,
                getReputationTier(selected.reputation).color,
              )}
            >
              {getReputationTier(selected.reputation).tier} ·{" "}
              {selected.reputation} Rep
            </div>
          )}
        </div>
      </div>
      {/* Close button comes from the surrounding TacticalModal. */}
    </div>
  );
}
