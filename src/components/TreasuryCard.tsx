// src/components/TreasuryCard.tsx
// Live Claim Treasury health. Purely presentational — all numbers come from
// the server (src/lib/treasury.server.ts). Refreshes when it becomes visible.
import { useEffect, useRef, useState } from "react";
import { ShieldCheck, Activity, Loader2, Zap } from "lucide-react";
import {
  getTreasuryHealthFn,
  type TreasurySnapshot,
} from "@/lib/treasury.functions";
import {
  ENERGY_ZONE_LABEL,
  ENERGY_ZONE_REGEN_MULT,
  type EnergyTreasuryZone,
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const ZONE_UI: Record<
  TreasurySnapshot["zone"],
  { label: string; text: string; bar: string; ring: string }
> = {
  green: {
    label: "Healthy",
    text: "text-neon-green",
    bar: "bg-neon-green",
    ring: "border-neon-green/30",
  },
  yellow: {
    label: "Tightening",
    text: "text-neon-amber",
    bar: "bg-neon-amber",
    ring: "border-neon-amber/30",
  },
  red: {
    label: "Strained",
    text: "text-destructive",
    bar: "bg-destructive",
    ring: "border-destructive/40",
  },
  critical: {
    label: "Critical",
    text: "text-destructive",
    bar: "bg-destructive",
    ring: "border-destructive/60",
  },
};

export function TreasuryCard({ className }: { className?: string }) {
  const [snap, setSnap] = useState<TreasurySnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    try {
      const res = await getTreasuryHealthFn();
      setSnap(res);
    } catch {
      /* offline */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    const el = boxRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) void load();
      },
      { threshold: 0.4 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const zone = snap ? ZONE_UI[snap.zone] : ZONE_UI.green;
  const fill = snap ? Math.min(100, (snap.healthRatio / 2) * 100) : 0;

  const energyZone = (snap?.zone ?? "yellow") as EnergyTreasuryZone;
  const energyMult = ENERGY_ZONE_REGEN_MULT[energyZone] ?? 1;
  const energyLabel = ENERGY_ZONE_LABEL[energyZone] ?? "Normal regen";

  return (
    <div
      ref={boxRef}
      className={cn(
        "holo-panel p-4",
        snap ? zone.ring : "border-border",
        className,
      )}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="flex items-center gap-2 hud-title text-muted-foreground">
          <ShieldCheck className="h-4 w-4 text-destructive" />
          Treasury Health
        </h3>
        {loading && !snap ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : snap ? (
          <span
            className={cn(
              "hud-chip",
              zone.text,
            )}
          >
            {zone.label}
          </span>
        ) : null}
      </div>

      {!snap ? (
        <p className="text-[0.7rem] text-muted-foreground">
          Treasury desk offline — reopen the app to refresh.
        </p>
      ) : (
        <>
          <div className="flex items-end justify-between">
            <div>
              <div className={cn("text-2xl font-mono font-black", zone.text)}>
                {snap.healthRatio.toFixed(2)}x
              </div>
              <div className="hud-label">
                Health ratio
              </div>
            </div>
            <div className="text-right">
              <div className="flex items-center justify-end gap-1 text-xl font-mono font-black text-foreground">
                <Activity className="h-4 w-4 text-destructive" />
                {snap.taxMultiplier.toFixed(2)}x
              </div>
              <div className="hud-label">
                Live fee multiplier
              </div>
            </div>
          </div>

          <div className="progress-track mt-3">
            <div
              className={cn("progress-fill h-full transition-all", zone.bar)}
              style={{ width: `${fill}%` }}
            />
          </div>

          {/* Dynamic energy readout */}
          <div className="mt-3 flex items-center justify-between hud-card p-3">
            <div className="flex items-center gap-2">
              <Zap className={cn("h-3.5 w-3.5", zone.text)} />
              <span className="hud-label">
                Merge energy
              </span>
            </div>
            <div className="text-right">
              <div className={cn("text-sm font-mono font-black", zone.text)}>
                {energyMult.toFixed(2)}× regen
              </div>
              <div className="hud-label">
                {energyLabel}
              </div>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <Cell label="$WARDOG pool" value={snap.balanceWardog} />
            <Cell label="$WARCAT pool" value={snap.balanceWarcat} />
            <Cell label="Owed to players" value={snap.totalClaimable} />
          </div>

          <p className="mt-3 text-[0.65rem] leading-relaxed text-muted-foreground">
            The treasury backs every claimable token. When the pool thins, in-game
            fees rise and merge-board energy regenerates slower — so the system
            self-heals. Merge board stays free (energy only).{" "}
            <span className={zone.text}>{snap.zoneNote}</span>
          </p>
        </>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: number }) {
  return (
    <div className="hud-card p-3">
      <div className="truncate text-sm font-mono font-black text-foreground">
        {Math.round(value).toLocaleString()}
      </div>
      <div className="hud-label">
        {label}
      </div>
    </div>
  );
}
