// src/components/TutorialModal.tsx
import { motion } from "framer-motion";
import { BookOpen, Swords, Zap, Trophy, Coins, Flag, Flame } from "lucide-react";
import { TacticalCTA, TacticalModal, TacticalSection } from "@/components/ui/TacticalModal";
import { STARTER_PACK } from "@/lib/game-state";
import { haptic } from "@/lib/telegram";

interface Props {
  open: boolean;
  onComplete: () => void;
  onSkip: () => void;
}

const STEPS = [
  {
    icon: Swords,
    title: "Build your army",
    body: "Connect your TON wallet and your real memecoins appear as tiles. Without a wallet you can explore with a demo army.",
  },
  {
    icon: Zap,
    title: "Start a battle",
    body: "Drag one coin onto another, or tap two coins. Pick an action: absorb into the stronger coin, total war, form an alliance, or retreat to GRAM.",
  },
  {
    icon: Flame,
    title: "Best route, clear cost",
    body: "Every battle checks DeDust and STON.fi for the best price. You see the expected output, price impact and War Tax before you confirm in your wallet.",
  },
  {
    icon: Coins,
    title: "Earn dual tokens",
    body: "Battles earn $WARDOG and $WARCAT rewards. Claim them to your wallet or spend them in the Shop and Nations vault.",
  },
  {
    icon: Flag,
    title: "Claim Nations",
    body: "Join WARDOG or WARCAT, or claim a real country. First joiner becomes leader. Compete, donate to the vault, and activate buffs.",
  },
  {
    icon: Trophy,
    title: "Climb the ranks",
    body: "Every battle scores season points for your champion coin. Only one memecoin wins the season. Refer friends and top the leaderboard.",
  },
];

export function TutorialModal({ open, onComplete, onSkip }: Props) {
  return (
    <TacticalModal
      open={open}
      tone="cyan"
      badge="Field manual"
      badgeIcon={BookOpen}
      title="Welcome, Commander"
      subtitle="Your briefing before the first battle."
      align="center"
      footer={
        <div className="flex gap-2">
          <TacticalCTA
            variant="ghost"
            buzz="none"
            className="flex-1 text-xs"
            onClick={() => {
              haptic("light");
              onSkip();
            }}
          >
            Skip
          </TacticalCTA>
          <TacticalCTA
            variant="deploy"
            buzz="none"
            className="flex-[2] text-xs"
            onClick={() => {
              haptic("medium");
              onComplete();
            }}
          >
            Deploy & claim pack
          </TacticalCTA>
        </div>
      }
    >
      <div className="mt-4 space-y-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.04 * i }}
              className="flex gap-3 rounded-xl border border-border bg-secondary/60 p-3"
            >
              <div className="h-fit rounded-lg border border-neon-cyan/40 bg-background/60 p-2 text-neon-cyan">
                <Icon className="h-5 w-5" />
              </div>
              <div className="flex-1">
                <div className="text-xs font-black uppercase tracking-wider text-foreground">
                  {i + 1}. {s.title}
                </div>
                <p className="mt-1 text-[0.7rem] leading-snug text-muted-foreground">{s.body}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <TacticalSection label="Starter supply drop" className="border-neon-amber/40 text-center">
        <div className="mt-1 text-[0.75rem] font-black neon-text-amber">
          +{STARTER_PACK.glory} Glory · +{STARTER_PACK.energy}⚡ · +{STARTER_PACK.wardog} $WARDOG · +{STARTER_PACK.warcat} $WARCAT
        </div>
      </TacticalSection>
    </TacticalModal>
  );
}
