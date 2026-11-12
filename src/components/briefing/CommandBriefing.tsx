import { useEffect, useMemo, useState } from "react";
import { ANTAGONIST_TRANSMISSION } from "@/lib/briefing/lore";
import { Crosshair, Gift } from "lucide-react";
import { TIER_RULES, type CoinTier, type MarketCoin } from "@/lib/war-cycle/cycle";
import { hapticNotify } from "@/lib/telegram";
import { useTierBoard } from "@/lib/cache/use-cached";
import { WarChestTicker } from "@/components/vault/WarChestTicker";
import { TacticalCTA, TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";

export const BRIEFING_KEY_PREFIX = "won:briefing:";

export function briefingKey(now = Date.now()) {
  return `${BRIEFING_KEY_PREFIX}${new Date(now).toISOString().slice(0, 10)}`;
}

const fmtUsd = (n: number) => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);

function frontLine(board: Record<CoinTier, MarketCoin[]> | null) {
  if (!board) return null;
  for (const tier of ["admiral", "captain", "recruit"] as CoinTier[]) {
    const top = [...(board[tier] ?? [])].sort((a, b) => b.volume24hUsd - a.volume24hUsd);
    if (top[0]) return { tier, leader: top[0], rival: top[1] ?? null };
  }
  return null;
}

export function CommandBriefing({
  open,
  canClaimDaily,
  streak,
  onClaimDaily,
  onDeploy,
  onClose,
}: {
  open: boolean;
  canClaimDaily: boolean;
  streak: number;
  onClaimDaily: () => void | Promise<void>;
  onDeploy: () => void;
  onClose: () => void;
}) {
  const { data } = useTierBoard();
  const board = (data?.board ?? null) as Record<CoinTier, MarketCoin[]> | null;
  const [claimed, setClaimed] = useState(false);

  const [lines, setLines] = useState(0);
  useEffect(() => {
    if (!open) return;
    setLines(0);
    const id = window.setInterval(() => {
      setLines((n) => {
        if (n >= ANTAGONIST_TRANSMISSION.length) { window.clearInterval(id); return n; }
        return n + 1;
      });
    }, 900);
    return () => window.clearInterval(id);
  }, [open]);

  const front = useMemo(() => frontLine(board), [board]);
  const glory = 100 + streak * 25;

  async function claim() {
    await onClaimDaily();
    setClaimed(true);
    hapticNotify("success");
  }

  return (
    <TacticalModal
      open={open}
      onClose={onClose}
      title="Daily command briefing"
      badge="Incoming transmission"
      tone="cyan"
      footer={
        <TacticalCTA onClick={onDeploy}>
          <Crosshair className="h-5 w-5" /> Deploy to battlefield
        </TacticalCTA>
      }
    >
      <TacticalSection label="Enemy transmission">
        <div className="mt-1 space-y-1 text-sm italic text-foreground" aria-live="polite">
          {ANTAGONIST_TRANSMISSION.slice(0, Math.max(1, lines)).map((l) => (
            <p key={l} className="animate-in fade-in">{l}</p>
          ))}
        </div>
        {lines < ANTAGONIST_TRANSMISSION.length && (
          <button type="button" onClick={() => setLines(ANTAGONIST_TRANSMISSION.length)} className="mt-2 hud-label underline">
            Skip transmission
          </button>
        )}
      </TacticalSection>

      <div className="mt-3">
        <WarChestTicker compact />
      </div>

      <TacticalSection label="Front line">
        {front ? (
          <p className="mt-1 text-sm text-foreground">
            <b className="neon-text-amber">${front.leader.symbol}</b> leads the {TIER_RULES[front.tier].label} front with {fmtUsd(front.leader.volume24hUsd)} traded today
            {front.rival ? (
              <>
                {" "}— <b>${front.rival.symbol}</b> is closing in. Pick a side.
              </>
            ) : (
              "."
            )}
          </p>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Scanning the market…</p>
        )}
      </TacticalSection>

      <TacticalSection className="flex items-center gap-3">
        <div className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-neon-amber/60">
          <Gift className="h-5 w-5 text-neon-amber" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-black text-foreground">Supply drop · day {streak + 1}</div>
          <div className="text-[11px] text-muted-foreground">+{glory} glory · +30 energy</div>
        </div>
        <button
          type="button"
          disabled={!canClaimDaily || claimed}
          onClick={claim}
          className="hit-cta min-h-11 rounded-lg border border-neon-amber px-3 text-xs neon-text-amber disabled:opacity-40"
        >
          {claimed || !canClaimDaily ? "Claimed" : "Claim"}
        </button>
      </TacticalSection>
    </TacticalModal>
  );
}
