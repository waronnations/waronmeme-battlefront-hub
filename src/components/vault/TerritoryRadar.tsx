import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Radar } from "lucide-react";
import { getTerritoryFn } from "@/lib/vault.functions";
import { territoryLeader, TERRITORY_SIZE, type Sector } from "@/lib/territory/territory";

export function TerritoryRadar() {
  const get = useServerFn(getTerritoryFn);
  const [sectors, setSectors] = useState<Sector[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [picked, setPicked] = useState<Sector | null>(null);

  useEffect(() => {
    get()
      .then((r) => {
        setSectors(r.sectors);
        setErr(r.error);
      })
      .catch(() => setErr("Market data is unavailable right now"));
  }, [get]);

  const leader = useMemo(() => (sectors ? territoryLeader(sectors) : null), [sectors]);
  const legend = useMemo(() => {
    const m = new Map<string, { symbol: string; hue: number; count: number }>();
    for (const s of sectors ?? []) {
      if (!s.symbol) continue;
      const e = m.get(s.symbol) ?? { symbol: s.symbol, hue: s.hue, count: 0 };
      e.count += 1;
      m.set(s.symbol, e);
    }
    return [...m.values()].sort((a, b) => b.count - a.count);
  }, [sectors]);

  return (
    <section aria-label="Territory radar" className="holo-panel p-4">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-foreground">
          <Radar className="h-4 w-4 text-neon-cyan" /> Territory radar
        </h3>
        {leader && <span className="text-[11px] font-bold neon-text-green">${leader.symbol} holds {leader.count} sectors</span>}
      </div>
      <p className="mt-1 text-[11px] text-muted-foreground">Coins capture sectors with live trading volume and liquidity. Tap a sector to see who holds it.</p>
      {err && <p className="mt-2 text-xs text-destructive">{err}</p>}
      {!sectors && !err && <div className="mt-3 aspect-square w-full animate-pulse rounded-xl bg-muted" />}
      {sectors && sectors.length > 0 && (
        <div className="mt-3 grid gap-1" style={{ gridTemplateColumns: `repeat(${TERRITORY_SIZE}, minmax(0, 1fr))` }}>
          {sectors.map((s) => (
            <button
              key={s.index}
              type="button"
              aria-label={s.symbol ? `Sector ${s.index + 1}: ${s.symbol}` : `Sector ${s.index + 1}: unclaimed`}
              onClick={() => setPicked(s)}
              className="sector-cell aspect-square border border-border text-[9px] font-black text-foreground"
              style={
                s.symbol
                  ? { background: `hsl(${s.hue} 90% 50% / 0.28)`, borderColor: `hsl(${s.hue} 90% 60% / 0.7)` }
                  : undefined
              }
            >
              {s.symbol?.slice(0, 4) ?? ""}
            </button>
          ))}
        </div>
      )}
      {picked && (
        <p className="mt-2 text-xs text-foreground">
          Sector {picked.index + 1}: {picked.symbol ? <b>${picked.symbol}</b> : "unclaimed"}
        </p>
      )}
      {legend.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {legend.map((l) => (
            <span key={l.symbol} className="rounded-full border px-2 py-0.5 text-[10px] font-bold text-foreground" style={{ borderColor: `hsl(${l.hue} 90% 60% / 0.7)` }}>
              ${l.symbol} · {l.count}
            </span>
          ))}
        </div>
      )}
    </section>
  );
}
