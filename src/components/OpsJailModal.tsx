// src/components/OpsJailModal.tsx
import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";
import { Lock, ShieldAlert, Share2 } from "lucide-react";
import { getOpsJailStatusFn } from "@/lib/battlefield.functions";
import { OPS_PROTECTED_LEADER_JAIL_MS } from "@/lib/constants";
import { haptic, shareStrikeRevenge } from "@/lib/telegram";
import { buildReferralLink } from "@/lib/referrals.shared";
import { toast } from "sonner";

export function OpsJailModal() {
  const [remainingMs, setRemainingMs] = useState(0);
  const [reason, setReason] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const s = await getOpsJailStatusFn();
      setRemainingMs(s.remainingMs);
      setReason(s.reason);
    } catch {
      /* keep previous */
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), 2500);
    return () => clearInterval(id);
  }, [refresh]);

  useEffect(() => {
    if (remainingMs <= 0) return;
    const id = setInterval(() => {
      setRemainingMs((ms) => Math.max(0, ms - 200));
    }, 200);
    return () => clearInterval(id);
  }, [remainingMs > 0]);

  const open = remainingMs > 0;
  const seconds = Math.ceil(remainingMs / 1000);
  const progress = open
    ? Math.min(1, remainingMs / OPS_PROTECTED_LEADER_JAIL_MS)
    : 0;

  const shareRevengeFromJail = () => {
    const referralLink = buildReferralLink(""); // falls back safely
    shareStrikeRevenge({ weaponId: "knife", referralLink });
    haptic("medium");
    toast.success("Share revenge — pick their chat");
  };

  return (
    <TacticalModal
      open={open}
      tone="amber"
      badge="World leader protection"
      badgeIcon={ShieldAlert}
      icon={<Lock className="h-8 w-8 animate-pulse" />}
      title="You are in jail"
      sound="alert"
      hapticOnOpen="error"
      layer="lock"
      align="center"
      footer={
        <>
          <TacticalCTA variant="amber" buzz="none" onClick={shareRevengeFromJail}>
            <Share2 className="h-4 w-4" /> Share revenge
          </TacticalCTA>
          <p className="flex items-center justify-center gap-1.5 text-[10px] leading-relaxed text-muted-foreground">
            <ShieldAlert className="h-3.5 w-3.5 text-neon-amber" /> All operations locked until the countdown ends.
          </p>
        </>
      }
    >
      <div className="flex flex-col items-center text-center">
        <p className="mt-3 text-sm leading-relaxed text-foreground">
          You attacked an important World Leader.
          <br />
          Take your jail time and lose glory points and WARDOG / WARCAT.
        </p>
        <div className="mt-6 flex flex-col items-center">
          <div className="text-6xl font-black tabular-nums tracking-tighter tac-text">{seconds}</div>
          <div className="mt-1 text-[10px] font-bold uppercase tracking-[0.25em] text-muted-foreground">seconds remaining</div>
        </div>
        <div className="mt-6 h-2 w-full overflow-hidden rounded-full bg-secondary">
          <motion.div
            className="cta-amber h-full origin-left rounded-full"
            style={{ scaleX: progress }}
            transition={{ duration: 0.2, ease: "linear" }}
          />
        </div>
      </div>
    </TacticalModal>
  );
}
