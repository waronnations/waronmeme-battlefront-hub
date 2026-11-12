// src/components/nuke/NationTargetGrid.tsx
import { Loader2, Shield } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";

export interface NationRow {
  id: number;
  name: string;
  tag: string;
  emblem: string;
  isDefault?: boolean;
  memberCount?: number;
  reputation?: number;
  lastNukeLaunchedAt?: string | null;
  nukesOwnedTotal?: number;
  timesNuked?: number;
  isProtected?: boolean;
}

export function NationTargetGrid({
  filtered,
  loadingNations,
  search,
  setSearch,
  selectedId,
  setSelectedId,
  setLastResult,
}: {
  filtered: NationRow[];
  loadingNations: boolean;
  search: string;
  setSearch: (v: string) => void;
  selectedId: number | null;
  setSelectedId: (id: number) => void;
  setLastResult: (v: null) => void;
}) {
  return (
    <div className="holo-panel p-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="hud-title flex items-center gap-2">Select target</h3>
        <span className="text-xs text-muted-foreground">{filtered.length} nations</span>
      </div>
      <input
        type="text"
        placeholder="Search nation..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="hud-input w-full px-3 py-2 "
      />
      {loadingNations ? (
        <div className="flex h-40 items-center justify-center text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      ) : (
        <div className="grid max-h-52 grid-cols-3 gap-2 overflow-y-auto pr-1 sm:grid-cols-4">
          {filtered.map((n) => {
            const active = selectedId === n.id;
            const arsenal = Number(n.nukesOwnedTotal ?? 0);
            const hits = Number(n.timesNuked ?? 0);
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => {
                  setSelectedId(n.id);
                  setLastResult(null);
                  haptic("light");
                }}
                className={cn(
                  "min-h-11 flex flex-col items-center gap-1 hud-card p-3 text-center transition-all",
                  active
                    ? "hud-card-active scale-[1.03]"
                    : n.isProtected
                      ? "border-border bg-secondary hover:border-border"
                      : "border-border bg-secondary/60 hover:border-border",
                )}
              >
                <span className="text-2xl leading-none">{n.emblem}</span>
                <span className="line-clamp-2 text-[11px] font-medium leading-tight text-foreground">
                  {n.name}
                </span>
                <span className="text-[9px] text-muted-foreground">{n.tag}</span>
                <div className="flex flex-wrap justify-center gap-1">
                  {n.isProtected && (
                    <span className="inline-flex items-center gap-0.5 hud-chip px-1.5 py-0.5 text-[9px] font-bold text-neon-green">
                      <Shield className="h-2.5 w-2.5" />
                      24h
                    </span>
                  )}
                  {arsenal > 0 && (
                    <span className="hud-chip px-1.5 py-0.5 text-[9px] font-bold text-foreground">
                      ☢ {arsenal}
                    </span>
                  )}
                  {hits > 0 && (
                    <span className="hud-chip px-1.5 py-0.5 text-[9px] font-bold text-destructive">
                      💥 {hits}×
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
