// src/components/nuke/StrikeResultCard.tsx
import { motion, AnimatePresence } from "framer-motion";
import { Skull, ShieldAlert, X } from "lucide-react";

export interface NukeResult {
  ok: boolean;
  glory?: number;
  energy?: number;
  tokens?: number;
  transferred?: number;
  wasPeaceful?: boolean;
  becameTerrorist?: boolean;
  targetName?: string;
  reason?: string;
}

export function StrikeResultCard({
  lastResult,
  phase,
  setLastResult,
  shareStrikeTelegram,
  shareStrikeX,
}: {
  lastResult: NukeResult | null;
  phase: "idle" | "launch" | "impact";
  setLastResult: (v: null) => void;
  shareStrikeTelegram: () => void;
  shareStrikeX: () => void;
}) {
  return (
    <AnimatePresence>
      {lastResult?.ok && phase === "idle" && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0 }}
          className="relative holo-panel p-4 text-center"
        >
          <button
            type="button"
            onClick={() => setLastResult(null)}
            className="min-h-11 absolute right-3 top-3 min-w-11 rounded-lg p-1 text-muted-foreground hover:brightness-110 hover:text-foreground"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>

          <div className="text-lg font-black text-foreground">☢ Strike successful</div>
          <div className="mt-1 text-sm text-foreground">
            {lastResult.targetName} has been hit
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2 text-sm">
            {lastResult.glory != null && (
              <div>
                <div className="font-bold text-foreground">
                  +{lastResult.glory.toLocaleString()}
                </div>
                <div className="text-[10px] text-muted-foreground">Glory</div>
              </div>
            )}
            {lastResult.energy != null && (
              <div>
                <div className="font-bold text-foreground">+{lastResult.energy}</div>
                <div className="text-[10px] text-muted-foreground">Energy</div>
              </div>
            )}
            {lastResult.tokens != null && (
              <div>
                <div className="font-bold text-foreground">
                  +{lastResult.tokens.toFixed(2)}
                </div>
                <div className="text-[10px] text-muted-foreground">Tokens</div>
              </div>
            )}
          </div>

          {lastResult.transferred != null && (
            <p className="mt-3 text-xs text-muted-foreground">
              {lastResult.transferred} tokens sent to their vault
            </p>
          )}

          {lastResult.wasPeaceful && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
              <ShieldAlert className="h-3.5 w-3.5" />
              Peaceful nation — reduced rewards
            </div>
          )}

          {lastResult.becameTerrorist && (
            <div className="mt-3 flex items-center justify-center gap-1.5 text-xs font-bold text-destructive">
              <Skull className="h-3.5 w-3.5" />
              You are now marked as a TERRORIST
            </div>
          )}

          <div className="mt-4 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={shareStrikeTelegram}
              className="min-h-11 min-h-[2.5rem] hud-card py-2.5 text-xs font-black uppercase tracking-widest text-primary-foreground hover:brightness-110"
            >
              Share Telegram
            </button>
            <button
              type="button"
              onClick={shareStrikeX}
              className="min-h-11 min-h-[2.5rem] hud-card py-2.5 text-xs font-black uppercase tracking-widest text-foreground hover:border-border"
            >
              Share on X
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
