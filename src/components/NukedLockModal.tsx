// src/components/NukedLockModal.tsx
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { AlertTriangle, Radiation } from "lucide-react";
import { NUKE_HIT_DISABLE_MS } from "@/lib/constants";
import { getMyNationFn } from "@/lib/nations.functions";

interface NationNukeStatus {
  lastNukeReceivedAt: string | null;
  name: string | null;
}

/**
 * Full-screen blocking modal shown to every member of a nation
 * that was just hit by a Strategic Nuke.
 * Player cannot dismiss it and cannot interact with the game
 * until the 60-second countdown reaches zero.
 *
 * Self-polls getMyNationFn so it works without extra props from the page.
 */
export function NukedLockModal() {
  const [status, setStatus] = useState<NationNukeStatus>({
    lastNukeReceivedAt: null,
    name: null,
  });
  const [remainingMs, setRemainingMs] = useState(0);

  const refresh = useCallback(async () => {
    try {
      const nation = await getMyNationFn();
      if (!nation) {
        setStatus({ lastNukeReceivedAt: null, name: null });
        return;
      }
      setStatus({
        lastNukeReceivedAt: (nation as any).lastNukeReceivedAt ?? null,
        name: nation.name ?? null,
      });
    } catch {
      // silent — keep previous status
    }
  }, []);

  // Poll nation status
  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 4000);
    return () => clearInterval(id);
  }, [refresh]);

  // Live countdown
  useEffect(() => {
    if (!status.lastNukeReceivedAt) {
      setRemainingMs(0);
      return;
    }

    const receivedAt = new Date(status.lastNukeReceivedAt).getTime();
    if (Number.isNaN(receivedAt)) {
      setRemainingMs(0);
      return;
    }

    const tick = () => {
      const left = Math.max(0, receivedAt + NUKE_HIT_DISABLE_MS - Date.now());
      setRemainingMs(left);
    };

    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [status.lastNukeReceivedAt]);

  const open = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = open
    ? Math.min(1, remainingMs / NUKE_HIT_DISABLE_MS)
    : 0;

  return (
    <TacticalModal
      open={open}
      tone="danger"
      badge="Strategic strike"
      badgeIcon={AlertTriangle}
      icon={<Radiation className="h-8 w-8 animate-pulse" />}
      title="Nation nuked"
      sound="alert"
      hapticOnOpen="error"
      layer="lock"
      align="center"
    >
      <div className="flex flex-col items-center text-center">
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          {status.name ? (
            <>
              <span className="font-semibold text-destructive">{status.name}</span> has been hit by a Strategic Nuke.
            </>
          ) : (
            "Your nation has been hit by a Strategic Nuke."
          )}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">All operations locked. Wait for the countdown.</p>

        <div className="mt-6 flex flex-col items-center">
          <div className="text-6xl font-black tabular-nums tracking-tighter tac-text">{seconds}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">seconds remaining</div>
        </div>

        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="cta-danger h-full origin-left rounded-full"
            style={{ scaleX: progress }}
            transition={{ duration: 0.2, ease: "linear" }}
          />
        </div>

        <p className="mt-5 text-[10px] leading-relaxed text-muted-foreground">
          You cannot merge, spawn, swap, or launch nukes until the lock expires. After 5 minutes you may strike back for revenge.
        </p>
      </div>
    </TacticalModal>
  );
}
