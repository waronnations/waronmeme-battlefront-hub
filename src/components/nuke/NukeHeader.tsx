// src/components/nuke/NukeHeader.tsx
import { Bomb, Skull } from "lucide-react";
import { TERRORIST_THRESHOLD } from "@/lib/constants";

export function NukeHeader({
  owned,
  isTerrorist,
  totalLaunched,
}: {
  owned: number;
  isTerrorist: boolean;
  totalLaunched: number;
}) {
  return (
    <div className="holo-panel holo-scan p-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="hud-title flex items-center gap-2">
            <Bomb className="h-5 w-5 text-destructive" />
            <span className="font-bold tracking-wide">STRATEGIC NUKES</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">
            Buy in Shop · Strike real nations · Value goes to their vault
          </p>
        </div>
        {isTerrorist && (
          <div className="flex items-center gap-1.5 hud-chip px-3 py-1 text-xs font-bold text-destructive">
            <Skull className="h-3.5 w-3.5" />
            TERRORIST
          </div>
        )}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 text-center">
        <div className="hud-card py-2.5">
          <div className="text-2xl font-mono font-black text-foreground">{owned}</div>
          <div className="hud-label text-[10px] text-muted-foreground">
            Owned
          </div>
        </div>
        <div className="hud-card py-2.5">
          <div className="text-2xl font-mono font-black text-foreground">{totalLaunched}</div>
          <div className="hud-label text-[10px] text-muted-foreground">
            Lifetime hits
          </div>
        </div>
      </div>

      {totalLaunched > 0 && totalLaunched < TERRORIST_THRESHOLD && (
        <p className="mt-3 text-center text-[11px] text-muted-foreground">
          {TERRORIST_THRESHOLD - totalLaunched} more until Terrorist status
        </p>
      )}
    </div>
  );
}
