// In-game quick swap: GRAM → faction tokens with a live multi-route selector.
// Quotes come from swap.coffee per venue; the chosen route is built server-side and signed in-game via TonConnect.
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { toast } from "sonner";
import {
  ArrowDown,
  ArrowRight,
  CheckCircle2,
  Coffee,
  GraduationCap,
  Loader2,
  Layers,
  Rocket,
  Route as RouteIcon,
  Settings2,
  ShieldAlert,
  Wallet,
  XCircle,
  ShieldCheck,
  ShieldX,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { buildSwapTxFn, getSwapMarketFn, getSwapRoutesFn, getSwapStatusFn } from "@/lib/dex.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { TTL } from "@/lib/cache/metric-cache";
import {
  DEFAULT_SLIPPAGE_BPS,
  SLIPPAGE_PRESETS_BPS,
  simulateQuote,
  swapAssets,
  validateSlippage,
  type SwapAsset,
  type SwapAssetKey,
  type SwapMarket,
} from "@/lib/dex/coffeeswap";
import {
  VENUES,
  minReceived,
  tradesInGame,
  venueById,
  type Graduation,
  type RouteQuote,
  type Safety,
  type SwapOutcome,
  type VenueId,
  type VenueKind,
} from "@/lib/dex/routes";
import { haptic, hapticSelect } from "@/lib/telegram";
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";
import { TacticalCTA, TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";
import { fmtAmount, fmtUsd } from "@/components/memewar/CoinLogo";
import { cn } from "@/lib/utils";

const AMOUNT_PRESETS = [1, 5, 10, 25];
const KIND_ICON: Record<VenueKind, LucideIcon> = { aggregator: Zap, dex: Layers, memepad: Rocket };
const TONE_TEXT = { green: "neon-text-green", cyan: "neon-text-cyan", amber: "neon-text-amber", red: "text-destructive" } as const;
const SAFETY_ICON = { green: ShieldCheck, cyan: ShieldCheck, amber: ShieldAlert, red: ShieldX } as const;

type Phase = "review" | "building" | "signing" | SwapOutcome;
const STATUS_POLL_MS = 3_000;
const STATUS_TIMEOUT_MS = 3 * 60_000;

function useDebounced<T>(value: T, ms: number): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

function AssetChip({ asset, image, active, onPick }: { asset: SwapAsset; image: string | null; active: boolean; onPick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={() => {
        hapticSelect();
        onPick();
      }}
      className={cn(
        "flex min-h-11 flex-1 items-center justify-center gap-2 rounded-lg border px-2 text-sm font-black",
        active ? "border-neon-cyan bg-secondary text-foreground" : "border-border text-muted-foreground",
      )}
    >
      <CachedTokenImage src={image} symbol={asset.symbol} className="h-6 w-6" />
      {asset.side === "faction" ? `$${asset.symbol}` : asset.symbol}
      {!asset.address && <span className="text-[9px] font-bold uppercase text-muted-foreground">soon</span>}
    </button>
  );
}

function SafetyBadge({ safety }: { safety: Safety }) {
  const Icon = SAFETY_ICON[safety.tone];
  return (
    <span className={cn("hud-chip", TONE_TEXT[safety.tone])} title={safety.note}>
      <Icon className="h-3 w-3" /> {safety.label}
    </span>
  );
}

function GraduationBadge({ g }: { g: Graduation }) {
  if (g.status === "dex") return null;
  if (g.status === "graduated")
    return (
      <span className="hud-chip neon-text-green" title={`Bonding curve completed on ${g.pad}; liquidity moved to DEX pools`}>
        <GraduationCap className="h-3 w-3" /> Graduated · {g.pad}
      </span>
    );
  return (
    <span className="hud-chip neon-text-amber" title={`${fmtAmount(g.collected)} / ${fmtAmount(g.target)} GRAM raised`}>
      <Rocket className="h-3 w-3" /> On curve · {Math.round(g.progress * 100)}%
    </span>
  );
}

function TokenIntelStrip({ symbol, safety, graduation }: { symbol: string; safety: Safety; graduation: Graduation }) {
  return (
    <div className="hud-card space-y-2 p-3">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="hud-label mr-1">${symbol} intel</span>
        <SafetyBadge safety={safety} />
        <GraduationBadge g={graduation} />
      </div>
      <p className="text-[11px] text-muted-foreground">{safety.note}.</p>
      {graduation.status === "curve" && (
        <div>
          <div className="flex justify-between text-[10px] font-bold text-muted-foreground">
            <span>Bonding curve · {graduation.pad}</span>
            <span className="font-mono">
              {fmtAmount(graduation.collected)} / {fmtAmount(graduation.target)} GRAM
            </span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-secondary" role="progressbar" aria-valuenow={Math.round(graduation.progress * 100)} aria-valuemin={0} aria-valuemax={100}>
            <div className="progress-fill-amber h-full" style={{ width: `${graduation.progress * 100}%` }} />
          </div>
        </div>
      )}
    </div>
  );
}

function RouteCard({
  quote,
  best,
  active,
  toSymbol,
  onPick,
}: {
  quote: RouteQuote | undefined;
  best: boolean;
  active: boolean;
  toSymbol: string;
  onPick: () => void;
}) {
  const venue = venueById(quote?.venue ?? "best");
  const Icon = KIND_ICON[venue.kind];
  const ok = quote?.ok === true;
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={!ok}
      onClick={() => {
        hapticSelect();
        onPick();
      }}
      className={cn(
        "hud-card flex min-h-14 w-full items-center gap-3 px-3 py-2 text-left disabled:cursor-not-allowed",
        active && "hud-card-active",
        !ok && "opacity-60",
      )}
    >
      <Icon className={cn("h-5 w-5 shrink-0", active ? "text-neon-cyan" : "text-muted-foreground")} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-black text-foreground">{venue.label}</span>
          {best && <span className="hud-chip neon-text-green">Best</span>}
          {ok && quote.estimate && <span className="hud-chip text-muted-foreground">Estimate</span>}
          {quote && !quote.ok && quote.graduated && (
            <span className="hud-chip neon-text-green">
              <GraduationCap className="h-3 w-3" /> Graduated
            </span>
          )}
        </div>
        <div className="truncate text-[11px] text-muted-foreground">
          {!quote ? venue.tagline : ok ? `${quote.dexes.join(" + ")} · ${(quote.priceImpact * 100).toFixed(1)}% impact` : quote.reason}
        </div>
      </div>
      {ok && (
        <div className="shrink-0 text-right">
          <div className={cn("font-mono text-sm font-black", best ? "neon-text-green" : "text-foreground")}>{fmtAmount(quote.amountOut)}</div>
          <div className="text-[10px] text-muted-foreground">${toSymbol}</div>
        </div>
      )}
    </button>
  );
}

export function QuickSwapPanel() {
  const getMarket = useServerFn(getSwapMarketFn);
  const getRoutes = useServerFn(getSwapRoutesFn);
  const buildSwap = useServerFn(buildSwapTxFn);
  const getStatus = useServerFn(getSwapStatusFn);
  const [tonConnectUI] = useTonConnectUI();
  const wallet = useTonAddress();
  const { data: marketData } = useCachedQuery("dex:swap-market", TTL.prices, () => getMarket(), { refreshMs: TTL.prices });
  const assets = useMemo(() => swapAssets(), []);
  const market = (marketData?.market ?? {}) as SwapMarket & Partial<Record<SwapAssetKey, { image: string | null }>>;

  const [fromKey, setFromKey] = useState<SwapAssetKey>("ton");
  const [toKey, setToKey] = useState<SwapAssetKey>("wardog");
  const [amountText, setAmountText] = useState("5");
  const [slippageBps, setSlippageBps] = useState(DEFAULT_SLIPPAGE_BPS);
  const [customSlip, setCustomSlip] = useState("");
  const [picked, setPicked] = useState<VenueId | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [phase, setPhase] = useState<Phase>("review");
  const [routeId, setRouteId] = useState<number | null>(null);
  const [sentOut, setSentOut] = useState<number | null>(null);
  const [swapErr, setSwapErr] = useState<string | null>(null);

  const from = assets.find((a) => a.key === fromKey)!;
  const to = assets.find((a) => a.key === toKey)!;
  const amountIn = Number(amountText.replace(",", "."));
  const validAmount = amountIn > 0 && amountIn <= 100_000;
  const debouncedAmount = useDebounced(validAmount ? amountIn : 0, 500);
  const slipErr = validateSlippage(slippageBps);

  const routeKey = debouncedAmount > 0 && from.address && to.address ? `dex:routes:${fromKey}:${toKey}:${debouncedAmount}` : null;
  const { data: routes, loading: routesLoading } = useCachedQuery(routeKey, TTL.routes, async () => ({
    ...(await getRoutes({ data: { from: fromKey, to: toKey, amount: debouncedAmount } })),
    key: routeKey,
  }));
  const fresh = !!routes && routes.key === routeKey && debouncedAmount === amountIn;
  const live = routes && !routes.error && routes.quotes.length > 0 ? routes : null;
  const quoteFor = (id: VenueId) => live?.quotes.find((q) => q.venue === id);

  // Keep the player's pick while it still has a quote; otherwise fall back to the best route.
  const pickedQuote = picked ? quoteFor(picked) : undefined;
  const venueId: VenueId = pickedQuote?.ok ? picked! : (live?.best ?? "best");
  const quote = quoteFor(venueId);
  const venue = venueById(venueId);

  // Offline fallback: constant-product estimate from pool depth when live routing is down.
  const offline = useMemo(
    () => (live ? null : simulateQuote({ amountIn, from, to, assets, market, slippageBps })),
    [live, amountIn, from, to, assets, market, slippageBps],
  );
  const intel = live?.tokens[toKey];
  const image = (k: SwapAssetKey) => market[k]?.image ?? null;
  const inGame = tradesInGame(venueId);
  // Only live, fresh, routed quotes can be signed — offline estimates are for orientation only.
  const canTrade = !!from.address && !!to.address && !slipErr && validAmount && !!live && fresh && quote?.ok === true && inGame;

  // Follow the swap on-chain until swap.coffee reports every split landed (or failed).
  useEffect(() => {
    if (phase !== "pending" || routeId === null) return;
    const started = Date.now();
    let stop = false;
    const tick = async () => {
      if (stop) return;
      const r = await getStatus({ data: { routeId } }).catch(() => null);
      if (stop) return;
      if (r && r.outcome !== "pending") {
        setPhase(r.outcome);
        haptic(r.outcome === "success" ? "heavy" : "medium");
        return;
      }
      if (Date.now() - started > STATUS_TIMEOUT_MS) {
        setPhase("success");
        return;
      }
      setTimeout(tick, STATUS_POLL_MS);
    };
    const t = setTimeout(tick, STATUS_POLL_MS);
    return () => {
      stop = true;
      clearTimeout(t);
    };
  }, [phase, routeId, getStatus]);

  function openConfirm() {
    if (!wallet) return void tonConnectUI.openModal();
    setPhase("review");
    setSwapErr(null);
    setRouteId(null);
    setSentOut(null);
    setConfirm(true);
  }

  async function execute() {
    if (!wallet || !canTrade) return;
    setSwapErr(null);
    setPhase("building");
    try {
      const res = await buildSwap({ data: { from: fromKey, to: toKey, amount: amountIn, venue: venueId, sender: wallet, slippageBps } });
      if (!res.swap) throw new Error(res.error ?? "Couldn't prepare the swap");
      setSentOut(res.swap.amountOut);
      setPhase("signing");
      await tonConnectUI.sendTransaction(res.swap.request);
      haptic("heavy");
      setRouteId(res.swap.routeId);
      setPhase(res.swap.routeId === null ? "success" : "pending");
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      const cancelled = /reject|cancel|declin/i.test(msg);
      setSwapErr(cancelled ? "Cancelled in your wallet — nothing was sent." : msg);
      setPhase("review");
      haptic("medium");
      if (cancelled) toast("Swap cancelled");
    }
  }

  const busy = phase === "building" || phase === "signing";
  const done = phase === "success" || phase === "partial" || phase === "failed";

  return (
    <section aria-label="Quick swap" className="holo-panel holo-scan space-y-3 p-4 pb-5">
      <div className="flex items-center justify-between">
        <h3 className="hud-title">
          <Coffee className="h-4 w-4 text-neon-amber" /> Quick swap
        </h3>
        <span className={cn("hud-chip", live ? "neon-text-green" : "text-muted-foreground")}>{live ? "Live routes" : "Offline estimate"}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Arm your faction: compare every safe route for GRAM → $WARDOG or $WARCAT, then trade in one tap.</p>

      <div>
        <label htmlFor="swap-amount" className="hud-label">
          You pay
        </label>
        <div className="mt-1 flex gap-2">
          {assets
            .filter((a) => a.side === "base")
            .map((a) => (
              <AssetChip key={a.key} asset={a} image={image(a.key)} active={a.key === fromKey} onPick={() => setFromKey(a.key)} />
            ))}
        </div>
        <input
          id="swap-amount"
          inputMode="decimal"
          autoComplete="off"
          value={amountText}
          onChange={(e) => setAmountText(e.target.value.replace(/[^0-9.,]/g, ""))}
          className="hud-input mt-2 h-12 font-mono text-lg font-black"
          aria-describedby="swap-amount-usd"
        />
        <div className="mt-2 flex gap-2">
          {AMOUNT_PRESETS.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setAmountText(String(n))}
              className={cn("min-h-11 flex-1 rounded-lg border text-xs font-bold", amountIn === n ? "border-neon-cyan text-foreground" : "border-border text-muted-foreground")}
            >
              {n}
            </button>
          ))}
        </div>
        <div id="swap-amount-usd" className="mt-1 text-[11px] text-muted-foreground">
          ≈ {validAmount && (market[fromKey]?.priceUsd ?? 0) > 0 ? fmtUsd(amountIn * market[fromKey]!.priceUsd) : "$—"}
          {amountIn > 100_000 && <span className="ml-2 text-destructive">Max 100,000 GRAM per quote</span>}
        </div>
      </div>

      <div className="flex justify-center">
        <ArrowDown className="h-5 w-5 text-neon-cyan" />
      </div>

      <div>
        <div className="hud-label">You get</div>
        <div className="mt-1 flex gap-2">
          {assets
            .filter((a) => a.side === "faction")
            .map((a) => (
              <AssetChip
                key={a.key}
                asset={a}
                image={image(a.key)}
                active={a.key === toKey}
                onPick={() => {
                  setToKey(a.key);
                  setPicked(null);
                }}
              />
            ))}
        </div>
      </div>

      {intel && <TokenIntelStrip symbol={to.symbol} safety={intel.safety} graduation={intel.graduation} />}

      <div>
        <div className="flex items-center justify-between">
          <div className="hud-label flex items-center gap-1.5">
            <RouteIcon className="h-3 w-3" /> Route
          </div>
          {routeKey && !fresh && live && <span className="text-[10px] font-bold text-muted-foreground">Updating…</span>}
        </div>
        <div role="radiogroup" aria-label="Swap route" className={cn("mt-1 space-y-1.5 transition-opacity", routeKey && !fresh && live && "opacity-60")}>
          {routeKey && routesLoading && !routes
            ? VENUES.map((v) => <div key={v.id} className="skeleton-shimmer h-14 rounded-xl" />)
            : VENUES.map((v) => (
                <RouteCard
                  key={v.id}
                  quote={live ? quoteFor(v.id) : undefined}
                  best={!!live && live.best === v.id}
                  active={!!live && venueId === v.id}
                  toSymbol={to.symbol}
                  onPick={() => setPicked(v.id)}
                />
              ))}
        </div>
      </div>

      <div>
        <div className="hud-label flex items-center gap-1.5">
          <Settings2 className="h-3 w-3" /> Slippage
        </div>
        <div className="mt-1 flex gap-2">
          {SLIPPAGE_PRESETS_BPS.map((bps) => (
            <button
              key={bps}
              type="button"
              aria-pressed={slippageBps === bps && !customSlip}
              onClick={() => {
                setCustomSlip("");
                setSlippageBps(bps);
              }}
              className={cn(
                "min-h-11 flex-1 rounded-lg border text-xs font-bold",
                slippageBps === bps && !customSlip ? "border-neon-cyan text-foreground" : "border-border text-muted-foreground",
              )}
            >
              {bps / 100}%
            </button>
          ))}
          <input
            aria-label="Custom slippage percent"
            inputMode="decimal"
            placeholder="Custom %"
            value={customSlip}
            onChange={(e) => {
              const v = e.target.value.replace(/[^0-9.,]/g, "");
              setCustomSlip(v);
              const pct = Number(v.replace(",", "."));
              setSlippageBps(v ? Math.round(pct * 100) : DEFAULT_SLIPPAGE_BPS);
            }}
            className="hud-input h-11 w-24 px-2 text-center text-xs font-bold"
          />
        </div>
        {slipErr && <p className="mt-1 text-[11px] text-destructive">{slipErr}</p>}
      </div>

      <div className="hud-card p-3" aria-live="polite">
        {live && quote?.ok ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="hud-label">{quote.estimate ? "Curve estimate" : "You receive"}</span>
              <span className="font-mono text-xl font-black neon-text-green">
                {fmtAmount(quote.amountOut)} <span className="text-xs text-foreground">${to.symbol}</span>
              </span>
            </div>
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
              <dt className="text-muted-foreground">Minimum received</dt>
              <dd className="text-right font-mono text-foreground">{fmtAmount(minReceived(quote.amountOut, slippageBps))}</dd>
              <dt className="text-muted-foreground">Price impact</dt>
              <dd className={cn("text-right font-mono", quote.priceImpact > 0.05 ? "text-destructive" : "text-foreground")}>
                {quote.estimate ? "—" : `${(quote.priceImpact * 100).toFixed(2)}%`}
              </dd>
              <dt className="text-muted-foreground">Rate</dt>
              <dd className="text-right font-mono text-foreground">
                1 GRAM ≈ {fmtAmount(quote.amountOut / debouncedAmount)} {to.symbol}
              </dd>
              <dt className="text-muted-foreground">Gas reserved</dt>
              <dd className="text-right font-mono text-foreground">≈ {quote.gasGram.toFixed(2)} GRAM</dd>
            </dl>
            <div className="mt-2 flex flex-wrap items-center gap-1 text-[11px] text-muted-foreground">
              <RouteIcon className="h-3 w-3" />
              {quote.hops.map((h, i) => (
                <span key={i} className="inline-flex items-center gap-1 font-bold text-foreground">
                  {i === 0 && h.from}
                  <ArrowRight className="h-3 w-3 text-neon-cyan" />
                  {h.to}
                  <span className="font-normal text-muted-foreground">({h.dex})</span>
                </span>
              ))}
              {quote.splits > 1 && <span>· split across {quote.splits} paths</span>}
            </div>
            {quote.priceImpact > 0.05 && <p className="mt-2 text-[11px] text-destructive">High price impact — try a smaller amount or another route.</p>}
          </>
        ) : live ? (
          <p className="text-sm text-muted-foreground">{quote && !quote.ok ? quote.reason : "No safe route for this amount yet."}</p>
        ) : routeKey && routesLoading ? (
          <div className="skeleton-shimmer h-16 rounded-lg" />
        ) : offline?.ok ? (
          <>
            <div className="flex items-baseline justify-between">
              <span className="hud-label">Offline estimate</span>
              <span className="font-mono text-xl font-black neon-text-green">
                {fmtAmount(offline.amountOut)} <span className="text-xs text-foreground">${to.symbol}</span>
              </span>
            </div>
            <p className="mt-1 text-[11px] text-muted-foreground">{routes?.error ?? "Live routes unavailable"} — showing a pool-depth estimate.</p>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">{!validAmount ? "Enter an amount" : (routes?.error ?? offline?.reason ?? "No route yet")}</p>
        )}
      </div>

      {!wallet ? (
        <TacticalCTA variant="amber" onClick={() => void tonConnectUI.openModal()}>
          <Wallet className="h-5 w-5" /> Connect wallet to swap
        </TacticalCTA>
      ) : (
        <TacticalCTA variant="amber" disabled={!canTrade} onClick={openConfirm}>
          <Zap className="h-5 w-5" /> {inGame ? `Swap via ${venue.app}` : "Curve buys coming soon"}
        </TacticalCTA>
      )}
      <p className="text-[10px] text-muted-foreground">
        {!inGame
          ? "Bonding-curve prices are shown for comparison; pick a DEX route to trade in-game."
          : "Quotes are live from swap.coffee and only route through verified or safe-contract jettons. You sign the swap right here in your own wallet — the game never holds your coins."}
      </p>

      <TacticalModal
        open={confirm}
        onClose={() => !busy && setConfirm(false)}
        tone={phase === "failed" ? "danger" : done ? "green" : "amber"}
        badge={done ? "Mission report" : "Supply run"}
        badgeIcon={Coffee}
        title={
          phase === "success"
            ? `$${to.symbol} secured`
            : phase === "partial"
              ? "Supply run partly landed"
              : phase === "failed"
                ? "Supply run failed"
                : phase === "pending"
                  ? "Swap in flight"
                  : `Buy $${to.symbol}`
        }
        subtitle={
          phase === "pending"
            ? "Signed. Waiting for the pools to settle on-chain…"
            : phase === "success"
              ? "The coins are in your wallet."
              : phase === "partial"
                ? "Part of the route filled; unspent GRAM was returned to your wallet."
                : phase === "failed"
                  ? "The pools refused the trade (price moved). Your GRAM was returned, minus network gas."
                  : `Routed through ${venue.label}. You'll sign in your wallet — no other app opens.`
        }
        footer={
          done ? (
            <TacticalCTA variant="deploy" buzz="light" onClick={() => setConfirm(false)}>
              Back to the war
            </TacticalCTA>
          ) : phase === "pending" ? (
            <TacticalCTA variant="ghost" buzz="light" onClick={() => setConfirm(false)}>
              Keep playing — it finishes on its own
            </TacticalCTA>
          ) : (
            <>
              <TacticalCTA variant="amber" disabled={busy || !canTrade} onClick={execute}>
                {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Wallet className="h-5 w-5" />}
                {phase === "building" ? "Preparing route…" : phase === "signing" ? "Confirm in wallet…" : "Sign swap"}
              </TacticalCTA>
              <TacticalCTA variant="ghost" buzz="light" disabled={busy} onClick={() => setConfirm(false)}>
                Stay in the war
              </TacticalCTA>
            </>
          )
        }
      >
        {phase === "pending" && (
          <div className="flex items-center justify-center py-2">
            <Loader2 className="h-8 w-8 animate-spin text-neon-cyan" aria-label="Waiting for confirmation" />
          </div>
        )}
        {phase === "success" && (
          <div className="flex items-center justify-center py-2">
            <CheckCircle2 className="h-10 w-10 text-neon-green" />
          </div>
        )}
        {phase === "failed" && (
          <div className="flex items-center justify-center py-2">
            <XCircle className="h-10 w-10 text-destructive" />
          </div>
        )}
        <TacticalSection label="Order">
          <div className="mt-1 text-sm text-foreground">
            {validAmount ? fmtAmount(amountIn) : "—"} GRAM → ≈ {fmtAmount(sentOut ?? (quote?.ok ? quote.amountOut : 0))} ${to.symbol}
          </div>
          {quote?.ok && (
            <dl className="mt-2 grid grid-cols-2 gap-y-1 text-[11px]">
              <dt className="text-muted-foreground">Minimum received</dt>
              <dd className="text-right font-mono text-foreground">{fmtAmount(minReceived(sentOut ?? quote.amountOut, slippageBps))}</dd>
              <dt className="text-muted-foreground">Route · slippage</dt>
              <dd className="text-right font-mono text-foreground">
                {venue.label} · {slippageBps / 100}%
              </dd>
              <dt className="text-muted-foreground">Gas attached</dt>
              <dd className="text-right font-mono text-foreground">≈ {quote.gasGram.toFixed(2)} GRAM (unused returns)</dd>
            </dl>
          )}
          {intel && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              <SafetyBadge safety={intel.safety} />
              <GraduationBadge g={intel.graduation} />
            </div>
          )}
          {swapErr && <p className="mt-2 text-[11px] text-destructive">{swapErr}</p>}
        </TacticalSection>
      </TacticalModal>
    </section>
  );
}
