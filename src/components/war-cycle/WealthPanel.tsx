import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Crown } from "lucide-react";
import { getWealthFn } from "@/lib/war-cycle.functions";
import { WEALTH_RANKS } from "@/lib/wealth/wealth";

type Me = { usd: number; tracked: boolean; rank: string; next: string | null; toNextUsd: number; progress: number };

export function WealthPanel() {
  const getWealth = useServerFn(getWealthFn);
  const [data, setData] = useState<{ available: boolean; me: Me | null; board: Array<{ userId: number; name: string; totalUsd: number; rank: string }> } | null>(null);

  useEffect(() => {
    getWealth({ data: { nationId: null } }).then(setData).catch(() => setData({ available: false, me: null, board: [] }));
  }, [getWealth]);

  return (
    <div className="space-y-4 px-4 pb-8">
      <section className="holo-panel p-4">
        <h3 className="hud-title flex items-center gap-2"><Crown className="h-4 w-4 text-neon-cyan" /> War chest rank</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Ranks and nation leadership go to the richest commanders, by connected wallet value averaged over 24 hours.</p>
        {data?.me ? (
          <>
            <div className="mt-3 flex items-end justify-between">
              <div className="text-2xl font-mono font-black text-foreground">{data.me.rank}</div>
              <div className="text-sm font-mono font-black neon-text-cyan">${data.me.usd.toLocaleString()}</div>
            </div>
            <div className="progress-track mt-2"><div className="progress-fill" style={{ width: `${data.me.progress * 100}%` }} /></div>
            <div className="mt-1 text-[11px] text-muted-foreground">
              {data.me.next ? `$${data.me.toNextUsd.toLocaleString()} to ${data.me.next}` : "Top rank reached"}
              {!data.me.tracked && " · first wallet scan pending"}
            </div>
          </>
        ) : (
          <div className="mt-3 grid grid-cols-4 gap-1 text-center text-[10px]">
            {WEALTH_RANKS.map((r) => (
              <div key={r.name} className="hud-card p-3"><div className="font-bold text-foreground">{r.name}</div><div className="text-muted-foreground">${r.minUsd.toLocaleString()}</div></div>
            ))}
          </div>
        )}
      </section>

      <section className="holo-panel p-4">
        <h3 className="hud-title flex items-center gap-2">Richest commanders</h3>
        {!data?.available ? (
          <p className="mt-2 text-xs text-muted-foreground">The wealth leaderboard appears once the game database is connected.</p>
        ) : data.board.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No wallets scanned yet. Connect your TON wallet to enter.</p>
        ) : (
          <ol className="mt-2 space-y-1 text-xs">
            {data.board.map((e, i) => (
              <li key={e.userId} className="hud-card p-3 flex items-center gap-2">
                <span className="w-5 font-black text-neon-cyan">{i + 1}</span>
                <span className="flex-1 font-semibold text-foreground">{e.name}</span>
                <span className="text-muted-foreground">{e.rank}</span>
                <span className="w-20 text-right font-mono font-black text-foreground">${Math.round(e.totalUsd).toLocaleString()}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
