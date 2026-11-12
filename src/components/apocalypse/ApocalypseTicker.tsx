// Doomsday banner for the command center: countdown, radiation meter and the
// apex survivor. Tap opens the full Apocalypse Protocol briefing.
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { AlertTriangle, ChevronRight, Crown, Radiation, Shield, Skull } from "lucide-react";
import type { MarketCoin } from "@/lib/war-cycle/cycle";
import { useApocalypseStandings, useTierBoard } from "@/lib/cache/use-cached";
import { preloadTokenImages } from "@/lib/cache/metric-cache";
import {
  BUNKER_PERKS,
  apexStandings,
  doomsdayClock,
  falloutWarnings,
  radiationLevel,
  type RadiationBand,
} from "@/lib/apocalypse/engine";
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";
import { TacticalCTA, TacticalModal, TacticalSection, tacticalFeedback } from "@/components/ui/TacticalModal";
import { cn } from "@/lib/utils";

const BAND_LABEL: Record<RadiationBand, string> = {
  calm: "Calm",
  elevated: "Elevated",
  severe: "Severe",
  critical: "Critical",
};
const BAND_TEXT: Record<RadiationBand, string> = {
  calm: "neon-text-green",
  elevated: "neon-text-amber",
  severe: "neon-text-amber",
  critical: "text-destructive",
};

const pad = (n: number) => String(n).padStart(2, "0");

function useNow(intervalMs = 1000) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function RadiationMeter({ level, band, className }: { level: number; band: RadiationBand; className?: string }) {
  return (
    <div
      role="meter"
      aria-label="Radiation level"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={level}
      className={cn("rad-track", band === "critical" && "rad-critical", className)}
    >
      <div className="rad-fill" style={{ width: `${Math.max(3, level)}%`, "--rad-scale": `${(100 / Math.max(3, level)) * 100}%` } as CSSProperties} />
    </div>
  );
}

export function ApocalypseTicker() {
  const now = useNow();
  const { data: boardRes } = useTierBoard();
  const { data: apoc } = useApocalypseStandings();
  const [open, setOpen] = useState(false);

  const coins = useMemo<MarketCoin[]>(() => {
    const b = boardRes?.board;
    return b ? [...b.admiral, ...b.captain, ...b.recruit] : [];
  }, [boardRes]);

  const holders = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of apoc?.standings ?? []) m.set(s.master, s.convictionHolders);
    return m;
  }, [apoc]);

  const standings = useMemo(() => apexStandings(coins, holders, 5), [coins, holders]);
  useEffect(() => preloadTokenImages(standings.map((s) => s.image)), [standings]);

  const clock = now === null ? null : doomsdayClock(now);
  const rad = now === null ? null : radiationLevel({ now, coins });
  const warnings = clock && rad ? falloutWarnings({ level: rad.level, msLeft: clock.msLeft, standings, coins }) : [];
  const apex = standings[0];

  return (
    <>
      <button
        type="button"
        aria-label="Open Apocalypse Protocol"
        onClick={() => {
          setOpen(true);
          if (rad?.band === "critical") tacticalFeedback("alert", "warning");
        }}
        className="holo-panel doomsday-banner flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left"
      >
        <Skull className="h-5 w-5 shrink-0 text-destructive" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">Doomsday</span>
            <span className="font-mono text-xs font-black text-foreground" aria-live="off">
              {clock ? `${clock.parts.d}d ${pad(clock.parts.h)}:${pad(clock.parts.m)}:${pad(clock.parts.s)}` : "––d ––:––:––"}
            </span>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <Radiation className={cn("h-3.5 w-3.5 shrink-0", rad ? BAND_TEXT[rad.band] : "text-muted-foreground")} />
            <RadiationMeter level={rad?.level ?? 0} band={rad?.band ?? "calm"} className="flex-1" />
            <span className={cn("w-9 text-right font-mono text-[11px] font-black", rad ? BAND_TEXT[rad.band] : "text-muted-foreground")}>
              {rad ? `${rad.level}%` : "––"}
            </span>
          </div>
        </div>
        {apex && (
          <div className="flex shrink-0 items-center gap-1.5 border-l border-border pl-3">
            <CachedTokenImage src={apex.image} symbol={apex.symbol} className="h-7 w-7" />
            <div className="leading-tight">
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">Apex</div>
              <div className="max-w-16 truncate text-xs font-black neon-text-amber">${apex.symbol}</div>
            </div>
          </div>
        )}
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <TacticalModal
        open={open}
        onClose={() => setOpen(false)}
        tone="danger"
        badge="Apocalypse protocol"
        badgeIcon={Skull}
        sound={rad?.band === "critical" ? "alert" : "transmission"}
        hapticOnOpen={rad?.band === "critical" ? "warning" : "medium"}
        title="Doomsday clock"
        subtitle="When the bullrun ends, every meme coin gets nuked. Only one apex coin survives the blast."
        footer={
          <TacticalCTA variant="danger" buzz="medium" onClick={() => setOpen(false)}>
            <Shield className="h-5 w-5" /> Back to the bunker
          </TacticalCTA>
        }
      >
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {(["d", "h", "m", "s"] as const).map((k) => (
            <div key={k} className="rounded-lg border border-border bg-secondary/60 py-2">
              <div className="font-mono text-xl font-black tac-text">{clock ? (k === "d" ? clock.parts.d : pad(clock.parts[k])) : "––"}</div>
              <div className="text-[9px] font-black uppercase tracking-wider text-muted-foreground">
                {{ d: "Days", h: "Hours", m: "Min", s: "Sec" }[k]}
              </div>
            </div>
          ))}
        </div>

        <TacticalSection label="Radiation">
          <div className="mt-1 flex items-baseline justify-between">
            <span className={cn("font-mono text-2xl font-black", rad ? BAND_TEXT[rad.band] : "text-muted-foreground")}>{rad ? `${rad.level}%` : "––"}</span>
            <span className={cn("text-xs font-black uppercase", rad ? BAND_TEXT[rad.band] : "text-muted-foreground")}>{rad ? BAND_LABEL[rad.band] : ""}</span>
          </div>
          <RadiationMeter level={rad?.level ?? 0} band={rad?.band ?? "calm"} className="mt-2" />
          {rad && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              {rad.timeRad}% from the clock · {rad.marketRad}% from market volatility ({coins.length ? `${coins.length} coins tracked` : "market data loading"})
            </p>
          )}
        </TacticalSection>

        <TacticalSection label="Apex survivor standings">
          {standings.length === 0 ? (
            <p className="mt-1 text-sm text-muted-foreground">Scanning the market…</p>
          ) : (
            <ol className="mt-2 space-y-2">
              {standings.map((s, i) => (
                <li key={s.master} className="flex items-center gap-2">
                  <span className={cn("w-4 text-center font-mono text-xs font-black", i === 0 ? "neon-text-amber" : "text-muted-foreground")}>{i + 1}</span>
                  <CachedTokenImage src={s.image} symbol={s.symbol} className="h-7 w-7" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1 truncate text-sm font-black text-foreground">
                        {i === 0 && <Crown className="h-3.5 w-3.5 shrink-0 text-neon-amber" />}${s.symbol}
                      </span>
                      <span className="font-mono text-[11px] text-muted-foreground">{s.score.toFixed(1)} pts</span>
                    </div>
                    <div className="progress-track mt-1">
                      <div className={cn("progress-fill", i === 0 && "progress-fill-amber")} style={{ width: `${Math.round((s.score / (standings[0]?.score || 1)) * 100)}%` }} />
                    </div>
                  </div>
                </li>
              ))}
            </ol>
          )}
          <p className="mt-2 text-[10px] text-muted-foreground">Score = conviction holders × 2 + liquidity and volume (log scale). Published formula, nobody can override it.</p>
        </TacticalSection>

        {warnings.length > 0 && (
          <TacticalSection label="Fallout warnings">
            <ul className="mt-1 space-y-1.5">
              {warnings.map((w) => (
                <li key={w.id} className="flex gap-2 text-[12px] text-foreground">
                  <AlertTriangle
                    className={cn(
                      "mt-0.5 h-3.5 w-3.5 shrink-0",
                      w.severity === "danger" ? "text-destructive" : w.severity === "warn" ? "text-neon-amber" : "text-muted-foreground",
                    )}
                  />
                  {w.text}
                </li>
              ))}
            </ul>
          </TacticalSection>
        )}

        <TacticalSection label="Bunker survival perks">
          <ul className="mt-1 space-y-1.5">
            {BUNKER_PERKS.map((p) => (
              <li key={p.id} className="text-[12px] text-foreground">
                <b className="neon-text-green">{p.title}</b> — {p.text}
              </li>
            ))}
          </ul>
        </TacticalSection>
      </TacticalModal>
    </>
  );
}
