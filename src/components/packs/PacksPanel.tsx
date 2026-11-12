import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonConnectUI, useTonAddress } from "@tonconnect/ui-react";
import { toast } from "sonner";
import { Package, Shuffle } from "lucide-react";
import { getPackPoolFn, markPackSentFn, preparePackFn } from "@/lib/war-cycle.functions";
import { PACK_PRICE_GRAM, PACK_SIZES, randomPack, type PackSize } from "@/lib/packs/packs";
import { TIER_RULES, type CoinTier, type MarketCoin } from "@/lib/war-cycle/cycle";

export function PacksPanel({ authenticated }: { authenticated: boolean }) {
  const getPool = useServerFn(getPackPoolFn);
  const prepare = useServerFn(preparePackFn);
  const markSent = useServerFn(markPackSentFn);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonAddress();

  const [tier, setTier] = useState<CoinTier | "any">("captain");
  const [size, setSize] = useState<PackSize>(10);
  const [pool, setPool] = useState<MarketCoin[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [bag, setBag] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState<{ sent: number; total: number } | null>(null);

  useEffect(() => {
    setPool([]);
    setBag([]);
    getPool({ data: { tier } })
      .then((r) => {
        setPool(r.coins);
        setErr(r.error);
      })
      .catch(() => setErr("Market data is unavailable right now"));
  }, [tier, getPool]);

  const floating = useMemo(() => pool.filter((c) => !bag.includes(c.master)).slice(0, 24), [pool, bag]);
  const bagCoins = bag.map((m) => pool.find((c) => c.master === m)).filter(Boolean) as MarketCoin[];

  function addToBag(m: string) {
    setBag((b) => (b.includes(m) || b.length >= size ? b : [...b, m]));
  }

  async function buy() {
    if (!wallet) return toast.error("Connect your TON wallet first");
    setBusy(true);
    try {
      const res = await prepare({ data: { size, tier, masters: bag } });
      if ("error" in res && res.error) return toast.error(res.error);
      if (!("txs" in res) || !res.txs || !res.order) return;
      let sent = 0;
      setProgress({ sent, total: res.txs.length });
      for (const tx of res.txs) {
        try {
          await tonConnectUI.sendTransaction(tx);
          sent++;
          setProgress({ sent, total: res.txs.length });
        } catch {
          break;
        }
      }
      await markSent({ data: { orderId: res.order.orderId, sent, total: res.txs.length } });
      if (sent === res.txs.length) {
        toast.success(`Pack sent: ${bag.length} coins on their way to your wallet`);
        setBag([]);
      } else toast.warning(`Signed ${sent} of ${res.txs.length} batches. Unsigned coins were not bought.`);
    } catch {
      toast.error("Couldn't buy the pack");
    } finally {
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <div className="space-y-4 px-4 pb-8">
      <section className="holo-panel holo-scan p-4">
        <h3 className="flex items-center gap-2 hud-title"><Package className="h-4 w-4 text-neon-cyan" /> Memecoin packs</h3>
        <p className="mt-1 text-[11px] text-muted-foreground">Only healthy coins with real liquidity and daily trading appear. Swaps run through STON.fi with 5% price protection; if the price moves too much, that coin's GRAM comes back.</p>
        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {PACK_SIZES.map((s) => (
            <button key={s} onClick={() => { setSize(s); setBag((b) => b.slice(0, s)); }} className={`min-h-11 hud-card p-3 text-center ${size === s ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
              <div className="text-sm font-mono font-black">{s}</div>
              <div className="text-[10px]">{PACK_PRICE_GRAM[s]} GRAM</div>
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          {(["any", "recruit", "captain", "admiral"] as const).map((t) => (
            <button key={t} onClick={() => setTier(t)} className={`min-h-11 flex-1 hud-card p-3 text-[10px] font-bold uppercase ${tier === t ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
              {t === "any" ? "All" : TIER_RULES[t].label}
            </button>
          ))}
        </div>
      </section>

      {/* Bag arena */}
      <section
        className="holo-panel p-4 relative h-80 overflow-hidden"
        onDragOver={(e) => e.preventDefault()}
      >
        {err && <p className="p-4 text-xs text-destructive">{err}</p>}
        {floating.map((c, i) => {
          const angle = (i / Math.max(1, floating.length)) * Math.PI * 2;
          const r = 38 + (i % 3) * 5;
          return (
            <button
              key={c.master}
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", c.master)}
              onClick={() => addToBag(c.master)}
              className="min-h-11 bag-float absolute flex h-11 w-11 -translate-x-1/2 -translate-y-1/2 flex-col items-center"
              style={{ left: `${50 + Math.cos(angle) * r}%`, top: `${50 + Math.sin(angle) * r}%`, ["--fx" as string]: `${(i % 5) - 2}px`, ["--fy" as string]: `${(i % 7) - 4}px`, animationDelay: `${(i % 6) * 0.3}s` }}
              title={c.symbol}
            >
              {c.image ? <img src={c.image} alt={c.symbol} className="h-9 w-9 rounded-full ring-1 ring-border" loading="lazy" /> : <div className="h-9 w-9 rounded-full bg-muted" />}
              <span className="text-[8px] font-bold text-muted-foreground">{c.symbol.slice(0, 6)}</span>
            </button>
          );
        })}
        <div
          onDrop={(e) => { e.preventDefault(); addToBag(e.dataTransfer.getData("text/plain")); }}
          onDragOver={(e) => e.preventDefault()}
          className="absolute left-1/2 top-1/2 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-2 border-dashed border-neon-cyan bg-background"
        >
          <Package className="h-8 w-8 text-neon-cyan" />
          <div className="mt-1 text-sm font-mono font-black text-foreground">{bag.length}/{size}</div>
          <div className="text-[9px] uppercase text-muted-foreground">tap or drag coins</div>
        </div>
      </section>

      {pool.length > 0 && pool.length < size && (
        <p className="text-[11px] text-muted-foreground">Only {pool.length} healthy coins match this tier right now. Pick a smaller pack or another tier.</p>
      )}
      <div className="flex flex-wrap gap-1">
        {bagCoins.map((c) => (
          <button key={c.master} onClick={() => setBag((b) => b.filter((x) => x !== c.master))} className="min-h-11 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-foreground">{c.symbol} ✕</button>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          disabled={pool.length < size}
          onClick={() => setBag(randomPack(pool, size, Date.now() & 0xffffffff).map((c) => c.master))}
          className="min-h-11 flex items-center justify-center gap-1.5 rounded-xl bg-secondary py-2.5 text-xs font-black uppercase text-foreground disabled:opacity-40"
        >
          <Shuffle className="h-4 w-4" /> Random pack
        </button>
        <button
          disabled={!authenticated || bag.length !== size || busy}
          onClick={buy}
          className="min-h-11 rounded-xl cta-amber hit-cta py-2.5 text-xs font-black uppercase text-background disabled:opacity-40"
        >
          {busy ? "Buying…" : `Buy for ${PACK_PRICE_GRAM[size]} GRAM`}
        </button>
      </div>
      {progress && (
        <div>
          <div className="progress-track"><div className="progress-fill" style={{ width: `${(progress.sent / progress.total) * 100}%` }} /></div>
          <div className="mt-1 text-[11px] text-muted-foreground">Sign batch {Math.min(progress.sent + 1, progress.total)} of {progress.total} in your wallet</div>
        </div>
      )}
      {!authenticated && <p className="text-[11px] text-muted-foreground">Sign in to buy packs.</p>}
    </div>
  );
}
