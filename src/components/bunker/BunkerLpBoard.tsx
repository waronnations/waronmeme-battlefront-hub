// Coin board liquidity front: every board coin's STON.fi pool metrics, fee split and Bunker LP totals.
import { useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Droplets, Shield, Skull } from "lucide-react";
import { getLpBoardFn, getMyBunkerFn } from "@/lib/bunker.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { TTL } from "@/lib/cache/metric-cache";
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";
import { cn } from "@/lib/utils";
import type { LpBoardRow } from "@/lib/bunker/lp";
import { BunkerLpModal } from "./BunkerLpModal";
import { fmtBps, fmtPct, fmtShare, fmtUsdShort } from "./format";

type SortKey = "tvl" | "apr" | "fees" | "bunker";
const SORTS: { id: SortKey; label: string }[] = [
  { id: "tvl", label: "Depth" },
  { id: "apr", label: "Fee APR" },
  { id: "fees", label: "LP fees" },
  { id: "bunker", label: "Bunker" },
];
const sortValue = (r: LpBoardRow, k: SortKey) =>
  k === "tvl" ? r.metrics.tvlUsd : k === "apr" ? r.metrics.feeApr : k === "fees" ? r.metrics.lpFees24hUsd : r.metrics.bunkerUsd;

function Metric({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="min-w-0">
      <div className="hud-label truncate text-[9px]">{label}</div>
      <div className={cn("truncate font-mono text-[12px] font-black text-foreground", tone)}>{value}</div>
    </div>
  );
}

export function BunkerLpBoard() {
  const getBoard = useServerFn(getLpBoardFn);
  const getMine = useServerFn(getMyBunkerFn);
  const { data, loading, refresh } = useCachedQuery("bunker:lp-board", TTL.board, () => getBoard(), { refreshMs: TTL.board });
  const { data: mine, refresh: refreshMine } = useCachedQuery("bunker:mine", TTL.routes, () => getMine());
  const [sort, setSort] = useState<SortKey>("tvl");
  const [open, setOpen] = useState<LpBoardRow | null>(null);

  const rows = useMemo(() => [...(data?.rows ?? [])].sort((a, b) => sortValue(b, sort) - sortValue(a, sort)), [data, sort]);
  const totals = useMemo(() => {
    const r = data?.rows ?? [];
    return {
      tvl: r.reduce((s, x) => s + x.metrics.tvlUsd, 0),
      fees: r.reduce((s, x) => s + x.metrics.lpFees24hUsd, 0),
      bunker: r.reduce((s, x) => s + x.metrics.bunkerUsd, 0),
      pledgers: r.reduce((s, x) => s + x.metrics.bunkerPledgers, 0),
    };
  }, [data]);
  const myByMaster = useMemo(() => new Map((mine?.pledges ?? []).map((p) => [p.coinMaster, p])), [mine]);

  return (
    <section className="holo-panel space-y-3 p-4" aria-labelledby="bunker-lp-title">
      <div className="flex items-center justify-between gap-2">
        <h3 id="bunker-lp-title" className="hud-title flex items-center gap-2">
          <Droplets className="h-4 w-4 text-neon-cyan" /> Bunker liquidity
        </h3>
        <span className="hud-chip text-muted-foreground">Until Doomsday</span>
      </div>
      <p className="text-[11px] text-muted-foreground">
        Supply a coin's STON.fi pool and pledge the LP until the nuke. Every swap pays the pool's LP fee to you; each pledge is a survivor vote for that coin while the LP stays in your wallet.
      </p>

      <div className="grid grid-cols-4 gap-2 text-center">
        <Metric label="Pool depth" value={fmtUsdShort(totals.tvl)} />
        <Metric label="LP fees 24h" value={fmtUsdShort(totals.fees)} tone="neon-text-green" />
        <Metric label="In bunker" value={fmtUsdShort(totals.bunker)} tone="neon-text-amber" />
        <Metric label="Pledgers" value={String(totals.pledgers)} />
      </div>

      {(mine?.pledges.length ?? 0) > 0 && (
        <div className="hud-card space-y-1.5 p-3">
          <div className="hud-label flex items-center gap-1.5"><Shield className="h-3.5 w-3.5 text-neon-cyan" /> Your bunker</div>
          {mine!.pledges.map((p) => (
            <div key={p.pool} className="flex items-center gap-2 text-xs">
              <span className="flex-1 font-bold text-foreground">${p.symbol}</span>
              <span className="text-muted-foreground">{fmtUsdShort(p.valueUsd)}</span>
              <span className="neon-text-green">{fmtUsdShort(p.feesPerDayUsd)}/day</span>
              <span className={cn("hud-chip", p.status === "holding" || p.status === "survived" ? "neon-text-green" : "text-destructive")}>{p.status}</span>
            </div>
          ))}
        </div>
      )}

      <div role="group" aria-label="Sort pools" className="hud-segment">
        {SORTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSort(s.id)}
            aria-pressed={sort === s.id}
            className={cn("min-h-11 flex-1 rounded-[0.7rem] border-0 bg-transparent px-1 text-[10px] font-black uppercase tracking-wider", sort === s.id ? "hud-segment-active" : "text-muted-foreground")}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading && <div className="progress-track"><div className="progress-fill w-1/2 animate-pulse" /></div>}
      {data?.error && <p className="text-xs text-destructive">{data.error}</p>}

      <ul className="space-y-2">
        {rows.map((r) => {
          const m = r.metrics;
          const my = myByMaster.get(r.master);
          return (
            <li key={r.master} className="hud-card space-y-2 p-3">
              <div className="flex items-center gap-2">
                <CachedTokenImage src={r.image} symbol={r.symbol} className="h-7 w-7 rounded-full" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-black text-foreground">${r.symbol}</span>
                    <span className="hud-chip text-muted-foreground">{r.tier}</span>
                    {my && <span className="hud-chip neon-text-green">pledged</span>}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {m.poolCount} pool{m.poolCount === 1 ? "" : "s"} · swap fee {fmtBps(m.feeBps)} = {fmtBps(m.lpFeeBps)} to LPs + {fmtBps(m.protocolFeeBps)} protocol
                  </div>
                </div>
                <button
                  onClick={() => setOpen(r)}
                  disabled={!r.canProvide}
                  className="hit-cta cta-amber min-h-11 shrink-0 px-3 text-[11px] font-black uppercase disabled:opacity-40"
                  aria-label={`Bunker LP for ${r.symbol}`}
                >
                  {r.canProvide ? "Bunker LP" : "No pool"}
                </button>
              </div>
              <div className="grid grid-cols-4 gap-2">
                <Metric label="Depth" value={fmtUsdShort(m.tvlUsd)} />
                <Metric label="Vol 24h" value={fmtUsdShort(m.volume24hUsd)} />
                <Metric label="Turnover" value={`${m.turnover.toFixed(2)}×`} />
                <Metric label="To LPs" value={fmtPct(m.lpFeeShare, 0)} />
                <Metric label="LP fees 24h" value={fmtUsdShort(m.lpFees24hUsd)} tone="neon-text-green" />
                <Metric label="Protocol 24h" value={fmtUsdShort(m.protocolFees24hUsd)} />
                <Metric label="Fee APR" value={fmtPct(m.feeApr)} tone="neon-text-green" />
                <Metric label="7d APY" value={m.apy7d > 0 ? fmtPct(m.apy7d) : "—"} />
                <Metric label="In bunker" value={fmtUsdShort(m.bunkerUsd)} tone="neon-text-amber" />
                <Metric label="Bunker %" value={fmtShare(m.bunkerShare)} />
                <Metric label="Bunker/day" value={fmtUsdShort(m.bunkerFees24hUsd)} />
                <Metric label="Votes" value={String(m.bunkerPledgers)} />
              </div>
            </li>
          );
        })}
      </ul>
      {!loading && rows.length === 0 && !data?.error && <p className="text-xs text-muted-foreground">No pools to show right now.</p>}
      <p className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
        <Skull className="h-3 w-3" /> Fee APR = 24h LP fees × 365 ÷ pool depth. Fees stay inside the pool and grow your LP; prices move, so LP can be worth less than you put in.
      </p>

      <BunkerLpModal
        row={open}
        onClose={() => setOpen(null)}
        onChanged={() => {
          void refresh();
          void refreshMine();
        }}
        signedIn={mine?.signedIn ?? false}
      />
    </section>
  );
}
