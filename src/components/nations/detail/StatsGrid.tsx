// src/components/nations/detail/StatsGrid.tsx
import type { NationDetails } from "../use-nations-panel";

export function StatsGrid({ selected }: { selected: NationDetails }) {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2">
      <div className="hud-card p-3">
        <div className="hud-label">
          Total Glory
        </div>
        <div className="mt-0.5 text-sm font-mono font-black neon-text-cyan">
          {selected.totalGlory.toLocaleString()}
        </div>
      </div>
      <div className="hud-card p-3">
        <div className="hud-label">
          Members
        </div>
        <div className="mt-0.5 text-sm font-mono font-black neon-text-cyan">
          {selected.memberCount}
        </div>
      </div>
    </div>
  );
}
