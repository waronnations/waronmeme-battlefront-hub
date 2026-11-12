import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Vault } from "lucide-react";
import { getWarChestFn } from "@/lib/vault.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { countdownParts, nextWeeklyBattle } from "@/lib/war-cycle/cycle";
import { displayTicker, NATIVE_TICKER } from "@/lib/tokens";

type Chest = { available: boolean; battleAt: number; pools: { key: string; symbol: string; amount: number }[] };

export function fmtAmount(n: number) {
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toFixed(4);
}

export function useWarChest(): Chest | null {
  const get = useServerFn(getWarChestFn);
  const { data } = useCachedQuery<Chest>("vault:chest", 60_000, () => get(), { refreshMs: 60_000 });
  return data ?? null;
}

export function WarChestTicker({ compact = false }: { compact?: boolean }) {
  const chest = useWarChest();
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Until the chest loads (or if its cycle already ended) count down to the next Sunday 18:00 UTC battle.
  const battleAt = chest && chest.battleAt > now ? chest.battleAt : nextWeeklyBattle(now);
  const p = countdownParts(battleAt - now);
  const pools = chest?.pools.length ? chest.pools : [{ key: "ton", symbol: NATIVE_TICKER, amount: 0 }];
  return (
    <section aria-label="War chest" className={`holo-panel holo-scan ${compact ? "p-3" : "p-4"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">
          <Vault className="h-3.5 w-3.5 text-neon-amber" /> War chest
        </div>
        <div className="font-mono text-[11px] text-muted-foreground">
          payout in {p.d}d {String(p.h).padStart(2, "0")}:{String(p.m).padStart(2, "0")}:{String(p.s).padStart(2, "0")}
        </div>
      </div>
      <div className="mt-2 flex flex-wrap items-baseline gap-x-4 gap-y-1">
        {pools.map((pool) => (
          <div key={pool.key} className="ticker-glow">
            <span className={`font-mono font-black neon-text-amber ${compact ? "text-xl" : "text-2xl"}`}>{fmtAmount(pool.amount)}</span>{" "}
            <span className="text-xs font-bold text-foreground">{displayTicker(pool.symbol)}</span>
          </div>
        ))}
      </div>
      {!compact && (
        <p className="mt-1 text-[11px] text-muted-foreground">
          Filled by 2% of every memecoin pack. Paid every Sunday 18:00 UTC to top commanders, the winning faction and diamond-hand holders.
        </p>
      )}
    </section>
  );
}
