import { useCallback, useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Bot, Skull, Swords, Timer, Trash2 } from "lucide-react";
import {
  activateStrategyFn,
  deleteStrategyFn,
  getApocalypseFn,
  getStrategiesFn,
  getTierBoardFn,
  saveStrategyFn,
} from "@/lib/war-cycle.functions";
import {
  APOCALYPSE_AT,
  countdownParts,
  nextWeeklyBattle,
  PRESET_STRATEGIES,
  TIER_RULES,
  type CoinTier,
  type MarketCoin,
  type WarStrategy,
} from "@/lib/war-cycle/cycle";

function useNow(ms = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

function Countdown({ label, at, now, icon: Icon }: { label: string; at: number; now: number; icon: typeof Timer }) {
  const p = countdownParts(at - now);
  return (
    <div className="hud-card p-3">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"><Icon className="h-3.5 w-3.5 text-neon-cyan" />{label}</div>
      <div className="mt-1 font-mono text-lg font-black text-foreground">
        {p.d}d {String(p.h).padStart(2, "0")}:{String(p.m).padStart(2, "0")}:{String(p.s).padStart(2, "0")}
      </div>
    </div>
  );
}

const fmtUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);

export function WarRoomPanel({ authenticated }: { authenticated: boolean }) {
  const now = useNow();
  const getBoard = useServerFn(getTierBoardFn);
  const getStrats = useServerFn(getStrategiesFn);
  const save = useServerFn(saveStrategyFn);
  const activate = useServerFn(activateStrategyFn);
  const del = useServerFn(deleteStrategyFn);
  const getApoc = useServerFn(getApocalypseFn);

  const [board, setBoard] = useState<Record<CoinTier, MarketCoin[]> | null>(null);
  const [boardErr, setBoardErr] = useState<string | null>(null);
  const [tier, setTier] = useState<CoinTier>("captain");
  const [strats, setStrats] = useState<Array<{ id: number; config: WarStrategy; active: boolean; agent: boolean }>>([]);
  const [stratsLive, setStratsLive] = useState(false);
  const [standings, setStandings] = useState<Array<{ master: string; symbol: string; image: string | null; score: number; convictionHolders: number }>>([]);
  const [draft, setDraft] = useState<WarStrategy>({ ...PRESET_STRATEGIES[1]!, name: "My strategy" });

  const load = useCallback(async () => {
    const b = await getBoard().catch(() => null);
    if (b) {
      setBoard(b.board);
      setBoardErr(b.error);
    }
    const a = await getApoc().catch(() => null);
    if (a) setStandings(a.standings);
    if (authenticated) {
      const s = await getStrats().catch(() => null);
      if (s) {
        setStrats(s.strategies);
        setStratsLive(s.available);
      }
    }
  }, [authenticated, getBoard, getApoc, getStrats]);

  useEffect(() => {
    void load();
  }, [load]);

  async function saveDraft(s: WarStrategy) {
    const res = await save({ data: s }).catch(() => null);
    if (!res) return toast.error("Couldn't save strategy");
    if (res.error) return toast.error(res.error);
    setStrats(res.strategies);
    toast.success("Strategy saved");
  }

  const active = strats.find((s) => s.active)?.config;
  const coins = board?.[tier] ?? [];
  const totalLiq = coins.reduce((s, c) => s + c.liquidityUsd, 0);
  const topMover = [...coins].sort((a, b) => b.volume24hUsd / Math.max(1, b.liquidityUsd) - a.volume24hUsd / Math.max(1, a.liquidityUsd))[0];

  return (
    <div className="space-y-4 px-4 pb-8">
      <div className="grid grid-cols-2 gap-2">
        <Countdown label="Next battle" at={nextWeeklyBattle(now)} now={now} icon={Swords} />
        <Countdown label="Apocalypse" at={APOCALYPSE_AT} now={now} icon={Skull} />
      </div>

      {/* Insights */}
      <section className="holo-panel holo-scan p-4">
        <h3 className="hud-title flex items-center gap-2">War insights</h3>
        <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
          <div><div className="text-muted-foreground">{TIER_RULES[tier].label} liquidity</div><div className="font-bold text-foreground">{fmtUsd(totalLiq)}</div></div>
          <div><div className="text-muted-foreground">Hottest</div><div className="font-bold text-neon-cyan">{topMover?.symbol ?? "–"}</div></div>
          <div><div className="text-muted-foreground">Your plan</div><div className="font-bold text-foreground">{active?.name ?? "None"}</div></div>
        </div>
      </section>

      {/* Tier board */}
      <section className="holo-panel p-4">
        <div className="flex gap-1.5">
          {(Object.keys(TIER_RULES) as CoinTier[]).map((t) => (
            <button key={t} onClick={() => setTier(t)} className={`min-h-11 flex-1 rounded-lg py-1.5 text-[11px] font-black uppercase ${tier === t ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
              {TIER_RULES[t].label}
            </button>
          ))}
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">Liquidity from {fmtUsd(TIER_RULES[tier].minLiquidityUsd)}. Coins with little trading are hidden.</p>
        {boardErr && <p className="mt-2 text-xs text-destructive">{boardErr}</p>}
        {!board && <div className="progress-track mt-3"><div className="progress-fill w-1/2 animate-pulse" /></div>}
        <ul className="mt-2 divide-y divide-border">
          {coins.slice(0, 10).map((c) => (
            <li key={c.master} className="flex items-center gap-2 py-1.5 text-xs">
              {c.image ? <img src={c.image} alt="" className="h-6 w-6 rounded-full" loading="lazy" /> : <div className="h-6 w-6 rounded-full bg-muted" />}
              <span className="flex-1 font-semibold text-foreground">{c.symbol}</span>
              <span className="text-muted-foreground">LP {fmtUsd(c.liquidityUsd)}</span>
              <span className="w-16 text-right text-muted-foreground">Vol {fmtUsd(c.volume24hUsd)}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Apocalypse standings */}
      <section className="holo-panel p-4">
        <h3 className="hud-title flex items-center gap-2"><Skull className="h-4 w-4 text-destructive" /> Apocalypse race</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">One memecoin wins. Score = conviction holders + liquidity + trading. AI agents can advise, but the formula decides. Hold the winner until the end to share the conviction reward.</p>
        {standings.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">Standings appear once the game database is connected.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-xs">
            {standings.slice(0, 5).map((s, i) => (
              <li key={s.master} className="hud-card p-3 flex items-center gap-2">
                <span className="w-4 font-black text-neon-cyan">{i + 1}</span>
                <span className="flex-1 font-semibold text-foreground">{s.symbol}</span>
                <span className="text-muted-foreground">{s.convictionHolders} holders</span>
                <span className="w-10 text-right font-mono font-black text-foreground">{s.score.toFixed(0)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* Strategies */}
      <section className="holo-panel p-4">
        <h3 className="hud-title flex items-center gap-2">Strategies</h3>
        <div className="mt-2 grid grid-cols-3 gap-1.5">
          {PRESET_STRATEGIES.map((p) => (
            <button key={p.name} disabled={!stratsLive} onClick={() => saveDraft(p)} className="min-h-11 border border-border bg-transparent px-2 py-2 text-[11px] font-bold uppercase text-secondary-foreground disabled:opacity-40">
              {p.name}
              <div className="text-[9px] font-normal normal-case text-muted-foreground">{p.horizon === "bullrun" ? "Full bullrun + nuke" : p.horizon}</div>
            </button>
          ))}
        </div>
        <div className="mt-3 space-y-2 hud-card p-3 text-xs">
          <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value.slice(0, 40) })} className="hud-input w-full px-3 py-2 " />
          <div className="flex gap-1.5">
            {(Object.keys(TIER_RULES) as CoinTier[]).map((t) => {
              const on = draft.tiers.includes(t);
              return (
                <button key={t} onClick={() => setDraft({ ...draft, tiers: on ? draft.tiers.filter((x) => x !== t) : [...draft.tiers, t] })} className={`min-h-11 flex-1 rounded-md py-1 text-[10px] font-bold uppercase ${on ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
                  {TIER_RULES[t].label}
                </button>
              );
            })}
          </div>
          <label className="flex items-center justify-between text-muted-foreground">
            Max position {draft.maxPositionPct}%
            <input type="range" min={1} max={100} value={draft.maxPositionPct} onChange={(e) => setDraft({ ...draft, maxPositionPct: Number(e.target.value) })} className="hud-input w-full px-3 py-2 " />
          </label>
          <label className="flex items-center justify-between text-muted-foreground">
            Hold until Apocalypse
            <input type="checkbox" checked={draft.holdUntilApocalypse} onChange={(e) => setDraft({ ...draft, holdUntilApocalypse: e.target.checked, horizon: e.target.checked ? "bullrun" : draft.horizon })} className="h-11 w-11 accent-neon-cyan" />
          </label>
          <button disabled={!stratsLive} onClick={() => saveDraft(draft)} className="hit-cta cta-deploy w-full py-2 font-bold uppercase text-primary-foreground disabled:opacity-40">Save strategy</button>
        </div>
        {!stratsLive && <p className="mt-2 text-[11px] text-muted-foreground">Saving strategies turns on once you're signed in and the database is connected.</p>}
        <ul className="mt-2 space-y-1.5">
          {strats.map((s) => (
            <li key={s.id} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${s.active ? "border-primary" : "border-border"}`}>
              <span className="flex-1 font-semibold text-foreground">{s.config.name}</span>
              <button onClick={async () => setStrats((await activate({ data: { id: s.id, agent: false } })).strategies)} className="min-h-11 rounded-md bg-muted px-2 py-1 text-[10px] font-bold uppercase text-foreground">{s.active ? "Active" : "Use"}</button>
              <button aria-label="Let an AI agent run this" onClick={async () => setStrats((await activate({ data: { id: s.id, agent: !s.agent } })).strategies)} className={`min-h-11 rounded-md px-2 py-1 ${s.agent ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}><Bot className="h-3.5 w-3.5" /></button>
              <button aria-label="Delete strategy" onClick={async () => setStrats((await del({ data: { id: s.id } })).strategies)} className="min-h-11 text-muted-foreground"><Trash2 className="h-3.5 w-3.5" /></button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
