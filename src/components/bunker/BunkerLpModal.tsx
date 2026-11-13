// Add liquidity to a coin's STON.fi pool (signed in the player's wallet) and pledge the LP until Doomsday.
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useTonAddress, useTonConnectUI } from "@tonconnect/ui-react";
import { toast } from "sonner";
import { Droplets, Loader2, Shield, Wallet } from "lucide-react";
import { buildProvideLpFn, getWalletLpFn, pledgeLpFn } from "@/lib/bunker.functions";
import { BUNKER_LP_RULES, type LpBoardRow } from "@/lib/bunker/lp";
import { TacticalCTA, TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";
import { haptic } from "@/lib/telegram";
import { fmtBps, fmtPct, fmtShare, fmtUsdShort } from "./format";

type Plan = NonNullable<Awaited<ReturnType<typeof buildProvideLpFn>>["plan"]>;

export function BunkerLpModal({ row, onClose, onChanged, signedIn }: { row: LpBoardRow | null; onClose: () => void; onChanged: () => void; signedIn: boolean }) {
  const wallet = useTonAddress();
  const [tonConnectUI] = useTonConnectUI();
  const build = useServerFn(buildProvideLpFn);
  const pledge = useServerFn(pledgeLpFn);
  const readLp = useServerFn(getWalletLpFn);
  const [amount, setAmount] = useState("1");
  const [plan, setPlan] = useState<Plan | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<"quote" | "sign" | "pledge" | null>(null);
  const [lp, setLp] = useState<{ valueUsd: number } | null>(null);

  const ton = Number(amount);
  const validAmount = ton >= BUNKER_LP_RULES.minTon && ton <= BUNKER_LP_RULES.maxTon;

  useEffect(() => {
    setPlan(null);
    setErr(null);
    setLp(null);
  }, [row?.master]);

  useEffect(() => {
    if (!row || !signedIn) return;
    readLp({ data: { master: row.master } })
      .then((r) => setLp({ valueUsd: r.valueUsd }))
      .catch(() => setLp(null));
  }, [row, signedIn, readLp]);

  useEffect(() => {
    if (!row || !wallet || !validAmount) return;
    const t = setTimeout(async () => {
      setBusy("quote");
      try {
        const r = await build({ data: { master: row.master, wallet, tonAmount: ton } });
        setPlan(r.plan);
        setErr(r.error);
      } catch {
        setErr("Couldn't price the deposit");
      } finally {
        setBusy(null);
      }
    }, 450);
    return () => clearTimeout(t);
  }, [row, wallet, ton, validAmount, build]);

  const enoughCoin = !plan || plan.coinBalanceUnits === null || BigInt(plan.coinBalanceUnits) >= BigInt(plan.coinUnits);

  async function sign() {
    if (!plan) return;
    setBusy("sign");
    try {
      await tonConnectUI.sendTransaction(plan.request);
      haptic("heavy");
      toast.success("Liquidity sent — pledge it once the LP lands (about a minute)");
      onChanged();
    } catch (e) {
      const msg = String((e as Error)?.message ?? e);
      toast(/reject|cancel|declin/i.test(msg) ? "Cancelled in your wallet — nothing was sent." : msg);
    } finally {
      setBusy(null);
    }
  }

  async function doPledge() {
    if (!row) return;
    setBusy("pledge");
    try {
      const r = await pledge({ data: { master: row.master } });
      if (r.error) toast.error(r.error);
      else {
        toast.success(`$${row.symbol} LP pledged until Doomsday`);
        haptic("heavy");
        onChanged();
      }
    } catch {
      toast.error("Sign in to pledge");
    } finally {
      setBusy(null);
    }
  }

  const m = row?.metrics;
  return (
    <TacticalModal
      open={row !== null}
      onClose={() => busy !== "sign" && onClose()}
      tone="amber"
      badge="Bunker LP"
      badgeIcon={Droplets}
      title={row ? `Supply $${row.symbol}` : ""}
      subtitle={`GRAM + $${row?.symbol ?? ""} go into the STON.fi pool. You sign in your own wallet; the LP stays yours.`}
      footer={
        <>
          {!wallet ? (
            <TacticalCTA variant="amber" onClick={() => void tonConnectUI.openModal()}>
              <Wallet className="h-5 w-5" /> Connect wallet
            </TacticalCTA>
          ) : (
            <TacticalCTA variant="amber" disabled={!plan || !enoughCoin || busy !== null} onClick={sign}>
              {busy === "sign" || busy === "quote" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Droplets className="h-5 w-5" />}
              {busy === "sign" ? "Confirm in wallet…" : "Add liquidity"}
            </TacticalCTA>
          )}
          <TacticalCTA variant="deploy" disabled={!signedIn || busy !== null} onClick={doPledge}>
            {busy === "pledge" ? <Loader2 className="h-5 w-5 animate-spin" /> : <Shield className="h-5 w-5" />}
            {signedIn ? `Pledge LP until Doomsday${lp && lp.valueUsd > 0 ? ` (${fmtUsdShort(lp.valueUsd)})` : ""}` : "Sign in to pledge"}
          </TacticalCTA>
        </>
      }
    >
      {m && (
        <div className="space-y-3">
          <TacticalSection label="Pool intel">
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div><div className="hud-label">Swap fee</div><div className="font-mono font-black text-foreground">{fmtBps(m.bunkerFeeBps || m.feeBps)}</div></div>
              <div><div className="hud-label">To LPs</div><div className="font-mono font-black neon-text-green">{fmtPct(m.lpFeeShare, 0)}</div></div>
              <div><div className="hud-label">Fee APR</div><div className="font-mono font-black neon-text-green">{fmtPct(m.feeApr)}</div></div>
            </div>
          </TacticalSection>
          <label htmlFor="lp-amount" className="hud-label">GRAM to deposit</label>
          <input
            id="lp-amount"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, "").slice(0, 10))}
            className="hud-input h-12 w-full px-3 font-mono text-lg font-black"
          />
          {!validAmount && <p className="text-xs text-destructive">Deposit between {BUNKER_LP_RULES.minTon} and {BUNKER_LP_RULES.maxTon} GRAM.</p>}
          {plan && (
            <div className="hud-card space-y-1 p-3 text-xs">
              <Row k={`Also sends $${plan.symbol}`} v={plan.coinAmount.toLocaleString(undefined, { maximumFractionDigits: 4 })} />
              <Row k="Your pool share" v={fmtShare(plan.poolShare)} />
              <Row k="Est. fees per day" v={fmtUsdShort(plan.feesPerDayUsd)} />
              <Row k="Network gas (refund of unused)" v={`≤ ${BUNKER_LP_RULES.maxGasTon} GRAM`} />
              {!enoughCoin && <p className="text-destructive">Not enough ${plan.symbol} in this wallet — buy some in Rewards → Swap first.</p>}
            </div>
          )}
          {err && <p className="text-xs text-destructive">{err}</p>}
          <p className="text-[10px] text-muted-foreground">
            Pledged LP counts as a survivor vote for ${row?.symbol} until Doomsday. Withdraw it early and the pledge breaks. Prices move — LP can be worth less than you put in.
          </p>
        </div>
      )}
    </TacticalModal>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{k}</span>
      <span className="font-mono font-bold text-foreground">{v}</span>
    </div>
  );
}
