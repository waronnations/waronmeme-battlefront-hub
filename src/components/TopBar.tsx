// src/components/TopBar.tsx
import { motion } from "framer-motion";
import { Star, Wallet, Swords } from "lucide-react";
import { type GameState } from "@/lib/game-state";
import { getRank, getLevel } from "@/lib/ranks";
import { cn } from "@/lib/utils";
import { usePayments } from "@/components/payments/PaymentProvider";
import { TopupButton } from "@/components/TopupButton";
import { ActionButton } from "@/components/ActionButton";

export function TopBar({ state }: { state: GameState }) {
  const { rank, next, progress } = getRank(state.glory);
  const level = getLevel(state.glory);
  const { connected, address, connectWallet, disconnectWallet } = usePayments();

  return (
    <div className="hud-bar sticky top-0 z-30 border-b px-3 py-3 backdrop-blur-xl">
      <div className="mx-auto max-w-md">
        <div className="flex items-center gap-3">
          <div className="relative shrink-0">
            <div className="grid h-11 w-11 place-items-center rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 text-neon-cyan shadow-[0_0_18px_-6px_var(--neon-cyan)]">
              <Swords className="h-6 w-6" />
            </div>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className="neon-text-cyan truncate text-sm font-black uppercase tracking-widest">
                  WARDOG MERGE
                </div>
                <div className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">
                  {rank.name} · Level {level}
                </div>
              </div>

              {next && (
                <div className="shrink-0 text-right">
                  <div className="hud-label">
                    Next
                  </div>
                  <div className="text-xs font-black uppercase text-foreground">
                    {next.name}
                  </div>
                </div>
              )}
            </div>

            <div className="relative mt-2">
              <div className="progress-track w-full">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-neon-cyan to-neon-green"
                  initial={{ width: 0 }}
                  animate={{ width: `${Math.max(3, progress * 100)}%` }}
                  transition={{ duration: 0.55, ease: "easeOut" }}
                />
              </div>
              <div className="absolute -top-3.5 right-0 font-mono text-[10px] text-muted-foreground">
                {Math.floor(progress * 100)}%
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-1.5">
            <div className="flex items-center gap-1.5 rounded-2xl border border-neon-amber/40 bg-neon-amber/10 px-2.5 py-1.5">
              <Star className="h-3.5 w-3.5 text-neon-amber" />
              <motion.span
                key={state.glory}
                initial={{ opacity: 0.5, y: 3 }}
                animate={{ opacity: 1, y: 0 }}
                className="neon-text-amber font-mono text-sm font-black tabular-nums"
              >
                {formatNum(state.glory)}
              </motion.span>
            </div>

            <div className="flex items-center gap-1">
              <TopupButton className="!min-h-9 !px-2 !py-1 !text-[0.55rem]" />
              <ActionButton
                type="button"
                title={
                  connected && address
                    ? `Connected ${address.slice(0, 6)}…${address.slice(-4)} · tap to disconnect`
                    : "Connect wallet (required for shop & paid actions)"
                }
                onClick={() => {
                  if (connected) void disconnectWallet();
                  else void connectWallet();
                }}
                className={cn(
                  "flex min-h-9 items-center gap-1 rounded-xl border px-2 py-1 text-[0.55rem] font-black uppercase tracking-wider transition",
                  connected
                    ? "border-neon-green/60 bg-neon-green/10 text-neon-green"
                    : "border-border bg-secondary text-muted-foreground",
                )}
              >
                <Wallet className="h-3 w-3" />
                {connected ? "On" : "Off"}
              </ActionButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 10_000) return Math.floor(n / 1_000) + "k";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
  return Math.floor(n).toString();
}
