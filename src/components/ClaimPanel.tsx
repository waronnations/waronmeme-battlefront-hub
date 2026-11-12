// src/components/ClaimPanel.tsx
import { useEffect, useState } from "react";
import {
  useTonConnectUI,
  useTonWallet,
  TonConnectButton,
} from "@tonconnect/ui-react";
import { Wallet, Loader2, Coins, Link2, Unlink, Info } from "lucide-react";
import { toast } from "sonner";
import type { GameState } from "@/lib/game-state";
import { TOKENS, shortenAddress } from "@/lib/tokens";
import { haptic } from "@/lib/telegram";
import {
  createClaim,
  getClaims,
  markClaimTxSubmitted,
  refundFailedClaim,
  type ClaimsSnapshot,
} from "@/lib/claims.functions";
import { TreasuryCard } from "@/components/TreasuryCard";
import { TopupButton } from "@/components/TopupButton";
import { ONCHAIN_CLAIM_GAS_TON } from "@/lib/onchain/contracts";
import { cn } from "@/lib/utils";
import type { TokenKey } from "@/components/claim/claim-helpers";
import { ClaimAmountControls } from "@/components/claim/ClaimAmountControls";
import { ClaimBalanceTiles } from "@/components/claim/ClaimBalanceTiles";
import { ClaimHistoryList } from "@/components/claim/ClaimHistoryList";

export type ClaimBalanceSyncPayload = {
  wardogTokens: number;
  warcatTokens: number;
  claimedWardog: number;
  claimedWarcat: number;
};

export function ClaimPanel({
  state,
  authenticated,
  onBalanceSync,
}: {
  state: GameState;
  authenticated: boolean;
  onBalanceSync?: (payload: ClaimBalanceSyncPayload) => void;
}) {
  const wallet = useTonWallet();
  const [tonConnectUI] = useTonConnectUI();
  const address = wallet?.account?.address;

  const [snapshot, setSnapshot] = useState<ClaimsSnapshot | null>(null);
  const [busy, setBusy] = useState<TokenKey | null>(null);
  const [amountWardog, setAmountWardog] = useState("");
  const [amountWarcat, setAmountWarcat] = useState("");

  const pushBalanceSync = (snap: ClaimsSnapshot) => {
    if (!onBalanceSync) return;
    onBalanceSync({
      wardogTokens: Number(state.wardogTokens ?? 0),
      warcatTokens: Number(state.warcatTokens ?? 0),
      claimedWardog: snap.claimed.wardog,
      claimedWarcat: snap.claimed.warcat,
    });
  };

  const applySnapshot = (snap: ClaimsSnapshot) => {
    setSnapshot(snap);
    pushBalanceSync(snap);
  };

  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const snap = await getClaims();
        if (!cancelled && "claims" in snap) {
          applySnapshot(snap);
        }
      } catch {
        /* offline */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, authenticated]);

  const disconnect = async () => {
    try {
      await tonConnectUI.disconnect();
      haptic("light");
      toast.success("Wallet disconnected");
    } catch {
      /* ignore */
    }
  };

  const parseAmount = (raw: string, available: number, minAmount: number) => {
    const n = Number(raw);
    if (!Number.isFinite(n) || n <= 0) {
      return { ok: false as const, error: "Enter a claim amount" };
    }
    if (n < minAmount) {
      return { ok: false as const, error: `Minimum claim is ${minAmount}` };
    }
    if (n > available + 1e-9) {
      return {
        ok: false as const,
        error: `Only ${available.toFixed(2)} available`,
      };
    }
    return { ok: true as const, amount: n };
  };

  const restoreAfterFailedTx = async (claimId: number) => {
    try {
      const refund = await refundFailedClaim({ data: { claimId } });
      if (refund.ok && refund.snapshot) {
        applySnapshot(refund.snapshot);
        return true;
      }
      const snap = await getClaims();
      if ("claims" in snap) applySnapshot(snap);
      return Boolean(refund.ok);
    } catch (e) {
      console.error("[restoreAfterFailedTx]", e);
      try {
        const snap = await getClaims();
        if ("claims" in snap) applySnapshot(snap);
      } catch {
        /* ignore */
      }
      return false;
    }
  };

  const submitClaim = async (token: TokenKey) => {
    if (!address) {
      toast.error("Connect your TON wallet first");
      return;
    }

    const available = balances[token];
    const raw = token === "wardog" ? amountWardog : amountWarcat;
    const parsed = parseAmount(raw, available, minAmount);
    if (!parsed.ok) {
      toast.error(parsed.error);
      return;
    }

    setBusy(token);
    try {
      const res = await createClaim({
        data: {
          token,
          beneficiaryAddress: address,
          amount: parsed.amount,
        },
      });

      if (!res.ok) {
        toast.error(
          {
            wallet_not_linked: "Connect your TON wallet first",
            claim_already_pending:
              "A claim for this token is already queued — wait for it to expire or retry after refresh",
            below_minimum: `You need at least ${snapshot?.minAmount ?? 10} to request a claim`,
            balance_changed: "Balance changed — try again",
            database_unavailable: "Claim desk offline — try again shortly",
            no_progress: "Progress not found — reopen the app",
            claims_paused:
              "Claims are paused while the treasury refills — check Treasury Health",
            daily_cap_reached: "Daily claim cap reached for this token",
            amount_too_small_for_zone:
              "Claimable slice is under the minimum in the current treasury zone",
            onchain_prepare_failed:
              "Could not build the TON transaction — tokens were not taken",
          }[res.error] ??
            res.note ??
            "Claim request failed",
        );
        const snap = await getClaims();
        if ("claims" in snap) applySnapshot(snap);
        return;
      }

      applySnapshot(res.snapshot);
      if (token === "wardog") setAmountWardog("");
      else setAmountWarcat("");

      if (res.onChain) {
        const { Buffer } = await import("buffer");
        (globalThis as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
        await import("@/lib/onchain/buffer-polyfill");

        const { buildClaimTransaction } = await import("@/lib/onchain/claim-tx");
        const tx = buildClaimTransaction({
          token: res.onChain.token,
          amount: BigInt(res.onChain.amount),
          beneficiary: res.onChain.beneficiary,
          nonce: BigInt(res.onChain.nonce),
          deadline: res.onChain.deadline,
          signatureHex: res.onChain.signature,
          gasTon: ONCHAIN_CLAIM_GAS_TON,
        });

        try {
          const result = await tonConnectUI.sendTransaction(tx);
          if (!result) {
            await restoreAfterFailedTx(res.claim.id);
            haptic("heavy");
            toast.error(
              "Wallet did not return a signed transaction — tokens restored",
            );
            return;
          }

          await markClaimTxSubmitted({
            data: {
              claimId: res.claim.id,
              txHash: result.boc ?? null,
            },
          });
          haptic("medium");
          toast.success(
            `${res.claim.amount.toFixed(2)} ${TOKENS[token].symbol} claim submitted on-chain`,
            {
              description: `Payout: ${res.onChain.beneficiary.slice(0, 6)}…${res.onChain.beneficiary.slice(-4)}. Gas ~${ONCHAIN_CLAIM_GAS_TON} GRAM.`,
            },
          );
          const snap = await getClaims();
          if ("claims" in snap) applySnapshot(snap);
        } catch (txErr: unknown) {
          await restoreAfterFailedTx(res.claim.id);
          haptic("heavy");
          const msg = String((txErr as { message?: string })?.message ?? "");
          const cancelled =
            msg.toLowerCase().includes("cancel") ||
            msg.toLowerCase().includes("reject") ||
            msg.toLowerCase().includes("user");
          toast.error(
            cancelled
              ? "Transaction cancelled — tokens restored to Claimable"
              : "Wallet did not sign — tokens restored to Claimable",
          );
        }
        return;
      }

      haptic("medium");
      toast.success(
        `${res.claim.amount.toFixed(2)} ${TOKENS[token].symbol} locked & queued`,
      );
    } catch (e) {
      console.error("[submitClaim]", e);
      toast.error("Claim request failed");
      try {
        const snap = await getClaims();
        if ("claims" in snap) applySnapshot(snap);
      } catch {
        /* ignore */
      }
    } finally {
      setBusy(null);
    }
  };

  const balances = snapshot ? snapshot.balances : { wardog: 0, warcat: 0 };
  const claimed = snapshot?.claimed ?? { wardog: 0, warcat: 0 };
  const total = snapshot?.total ?? {
    wardog: balances.wardog + claimed.wardog,
    warcat: balances.warcat + claimed.warcat,
  };
  const minAmount = snapshot?.minAmount ?? 10;
  const pendingClaims =
    snapshot?.claims.filter((c) => c.status === "pending") ?? [];
  const onChainLive =
    snapshot?.onChainLive === true ||
    snapshot?.claimTreasuryAddress?.startsWith("EQCbh4") === true;

  const canClaim = (token: TokenKey) =>
    Boolean(address) &&
    balances[token] >= minAmount &&
    !busy &&
    !pendingClaims.some((c) => c.token === token);

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <Coins className="h-4 w-4 text-neon-amber" />
          <h2 className="hud-title text-muted-foreground">
            Claim Center
          </h2>
        </div>
        <TopupButton className="!px-2.5 !py-1.5 !text-[0.6rem]" />
      </div>

      <TreasuryCard />

      <div className="hud-card p-3 text-[0.65rem] leading-relaxed text-neon-green/90">
        <p className="font-black uppercase tracking-wider text-neon-green">
          Two balances
        </p>
        <p className="mt-1 text-neon-green/70">
          <strong className="text-neon-green">Claimable</strong> = free rewards
          from the merge board. Claim them here to your TON wallet.
          <br />
          <strong className="text-neon-green">Topped-up</strong> = jettons you
          deposited. Required for shop, energy recover, nations & operations.
        </p>
      </div>

      <div className="holo-panel flex gap-3 p-4 border-neon-amber/30">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-neon-amber" />
        <div className="space-y-1 text-[0.7rem] leading-relaxed text-neon-amber/90">
          <p className="font-bold uppercase tracking-wider text-neon-amber">
            {onChainLive
              ? "On-chain claims — sign the wallet tx"
              : "Payouts are queued — not instant"}
          </p>
          <p className="text-neon-amber/70">
            {onChainLive ? (
              <>
                Jettons go to the{" "}
                <strong className="text-neon-amber">currently connected</strong>{" "}
                TON wallet. You pay ~{ONCHAIN_CLAIM_GAS_TON} GRAM gas. If you do
                not sign, tokens stay claimable.
              </>
            ) : (
              <>Claiming locks balance until batch payout is live.</>
            )}
          </p>
        </div>
      </div>

      <div className="holo-panel holo-scan p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-neon-amber" />
            <span className="hud-title text-foreground">
              Wallet
            </span>
          </div>
          {address ? (
            <button
              type="button"
              onClick={disconnect}
              className="min-h-11 flex items-center gap-1 hud-label hover:text-destructive"
            >
              <Unlink className="h-3 w-3" />
              Disconnect
            </button>
          ) : null}
        </div>

        {address ? (
          <div className="flex items-center gap-2 hud-card p-3">
            <Link2 className="h-4 w-4 text-neon-green" />
            <span className="font-mono text-xs text-neon-green">
              {shortenAddress(address)}
            </span>
          </div>
        ) : (
          <div className="flex justify-center py-1">
            <TonConnectButton />
          </div>
        )}
      </div>

      <ClaimBalanceTiles balances={balances} claimed={claimed} total={total} />

      <div className="space-y-3 holo-panel p-4">
        <div className="hud-title text-neon-amber">
          Claim {TOKENS.wardog.symbol} (merge rewards)
        </div>
        <ClaimAmountControls
          token="wardog"
          available={balances.wardog}
          minAmount={minAmount}
          value={amountWardog}
          onChange={setAmountWardog}
          disabled={Boolean(busy) || !address}
        />
        <button
          type="button"
          disabled={!canClaim("wardog")}
          onClick={() => submitClaim("wardog")}
          className={cn(
            "min-h-11 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-mono font-black uppercase tracking-wider transition",
            canClaim("wardog")
              ? "cta-amber hit-cta"
              : "hit-cta cursor-not-allowed bg-secondary text-muted-foreground",
          )}
        >
          {busy === "wardog" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {busy === "wardog" ? "Claiming…" : `Claim ${TOKENS.wardog.symbol}`}
        </button>
      </div>

      <div className="space-y-3 holo-panel p-4">
        <div className="hud-title text-neon-cyan">
          Claim {TOKENS.warcat.symbol} (merge rewards)
        </div>
        <ClaimAmountControls
          token="warcat"
          available={balances.warcat}
          minAmount={minAmount}
          value={amountWarcat}
          onChange={setAmountWarcat}
          disabled={Boolean(busy) || !address}
        />
        <button
          type="button"
          disabled={!canClaim("warcat")}
          onClick={() => submitClaim("warcat")}
          className={cn(
            "min-h-11 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-mono font-black uppercase tracking-wider transition",
            canClaim("warcat")
              ? "cta-deploy hit-cta"
              : "hit-cta cursor-not-allowed bg-secondary text-muted-foreground",
          )}
        >
          {busy === "warcat" ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Coins className="h-4 w-4" />
          )}
          {busy === "warcat" ? "Claiming…" : `Claim ${TOKENS.warcat.symbol}`}
        </button>
      </div>

      <ClaimHistoryList
        snapshot={snapshot}
        onRefund={async (claimId) => {
          setBusy("wardog");
          try {
            const ok = await restoreAfterFailedTx(claimId);
            toast[ok ? "success" : "error"](
              ok ? "Claim cancelled — tokens restored" : "Could not refund this claim",
            );
          } finally {
            setBusy(null);
          }
        }}
      />
    </div>
  );
}
