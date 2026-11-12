// src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Toaster, toast } from "sonner";

import { useGame } from "@/lib/game/use-game";
import { MAX_ENERGY } from "@/lib/constants";
import { RECOVER_ENERGY_TOKEN_COST } from "@/lib/constants";
import { initTelegram } from "@/lib/telegram";
import { useTelegramSession } from "@/hooks/use-telegram-session";
import { useLeaderboard, useServerProgress } from "@/hooks/use-server-progress";
import { useNotificationScheduler } from "@/hooks/use-notification-scheduler";
import { useGameHandlers } from "@/hooks/use-game-handlers";
import { TopBar } from "@/components/TopBar";
import { SubTabBar } from "@/components/game/SubTabBar";
import { LayoutGrid, ClipboardList, Crosshair } from "lucide-react";
import { PrimaryTabBar, type PrimaryTab } from "@/components/game/PrimaryTabBar";
import { GameModals } from "@/components/game/GameModals";
import { PlayTab } from "@/components/game/tabs/PlayTab";
import { OpsTab } from "@/components/game/tabs/OpsTab";
import { WorldTab, type WorldSub } from "@/components/game/tabs/WorldTab";
import { EarnTab, type EarnSub } from "@/components/game/tabs/EarnTab";
import { BaseTab, type BaseSub } from "@/components/game/tabs/BaseTab";
import { SeasonTab } from "@/components/game/tabs/SeasonTab";
import { BattlefieldTab } from "@/components/battlefield/BattlefieldTab";
import { CommandBriefing, briefingKey } from "@/components/briefing/CommandBriefing";
import { ApocalypseTicker } from "@/components/apocalypse/ApocalypseTicker";
import { useTelegramBackButton } from "@/hooks/use-telegram-ui";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "War On Nations — Memecoin War on TON" },
      {
        name: "description",
        content:
          "Merge your real TON memecoins on the war board. Live DeDust + STON.fi routes, War Tax in any coin, nations and seasonal rankings.",
      },
      {
        property: "og:title",
        content: "War On Nations — Memecoin War on TON",
      },
      {
        property: "og:description",
        content:
          "Merge your real TON memecoins on the war board. Live DeDust + STON.fi routes, War Tax in any coin, nations and seasonal rankings.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@waronnations" },
    ],
  }),
  component: WaronMergePage,
});

function WaronMergePage() {
  const game = useGame();
  const [tab, setTab] = useState<PrimaryTab>("play");
  const [warSub, setWarSub] = useState<"board" | "ops" | "battlefield">("board");
  const [worldSub, setWorldSub] = useState<WorldSub>("nations");
  const [earnSub, setEarnSub] = useState<EarnSub>("vault");
  const [baseSub, setBaseSub] = useState<BaseSub>("profile");
  const [showDaily, setShowDaily] = useState(false);
  const [showBriefing, setShowBriefing] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  const [showCocoonModal, setShowCocoonModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [generatedImageUrl, setGeneratedImageUrl] = useState<string | null>(null);

  const session = useTelegramSession();
  const authenticated = session.status === "authenticated";

  const {
    forceSync,
    pullFromServer,
    lastError,
    status: syncStatus,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
  } = useServerProgress({
    authenticated,
    localState: game.hydrated ? game.state : null,
    hydrate: game.hydrate,
    applyServerState: game.applyServerState,
    applyServerEconomy: game.applyServerEconomy,
  });

  const { entries: leaderboard, refresh: refreshLeaderboard } = useLeaderboard({
    authenticated,
    limit: 200,
  });

  useNotificationScheduler({
    authenticated,
    state: game.hydrated ? game.state : null,
  });

  const lastRateToastRef = useRef(0);

  const softRateLimitToast = useCallback(() => {
    const now = Date.now();
    if (now - lastRateToastRef.current < 4000) return;
    lastRateToastRef.current = now;
    toast.message("Slow down a bit", { duration: 1200 });
  }, []);

  useEffect(() => {
    initTelegram();
  }, []);

  useEffect(() => {
    if (!game.hydrated) return;
    if (!game.state.hasSeenTutorial) {
      setShowTutorial(true);
      return;
    }
    let seenToday = false;
    try {
      seenToday = window.localStorage.getItem(briefingKey()) === "1";
    } catch {
      /* storage blocked */
    }
    if (!seenToday || game.canClaimDaily()) {
      const t = setTimeout(() => setShowBriefing(true), 400);
      return () => clearTimeout(t);
    }
  }, [game.hydrated, game.canClaimDaily, game.state.hasSeenTutorial]);

  useEffect(() => {
    if (!authenticated) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        void forceSync();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authenticated, forceSync]);

  // Telegram top-bar back button: sub-view -> War board -> close.
  useTelegramBackButton(
    showBriefing
      ? null
      : tab !== "play"
        ? () => setTab("play")
        : warSub !== "board"
          ? () => setWarSub("board")
          : null,
  );

  const closeBriefing = useCallback(() => {
    setShowBriefing(false);
    try {
      window.localStorage.setItem(briefingKey(), "1");
    } catch {
      /* storage blocked */
    }
  }, []);

  const ranksSyncedRef = useRef(false);
  useEffect(() => {
    if (tab !== "season" || !authenticated) {
      ranksSyncedRef.current = false;
      return;
    }
    if (ranksSyncedRef.current) return;
    ranksSyncedRef.current = true;

    let cancelled = false;
    (async () => {
      await forceSync();
      if (!cancelled) await refreshLeaderboard();
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, authenticated]);

  useEffect(() => {
    if (!lastError) return;
    if (lastError === "rate_limited") softRateLimitToast();
  }, [lastError, softRateLimitToast]);

  const canRecoverWardog =
    game.state.energy < MAX_ENERGY &&
    game.state.wardogTokens >= RECOVER_ENERGY_TOKEN_COST;
  const canRecoverWarcat =
    game.state.energy < MAX_ENERGY &&
    game.state.warcatTokens >= RECOVER_ENERGY_TOKEN_COST;

  const missionsBadge =
    (game.state.dailyQuests?.filter((q) => q.progress >= q.target && !q.claimed)
      .length ?? 0) +
    (game.state.tasks?.filter((t) => t.done && !t.claimed).length ?? 0);

  const serverReady = authenticated && syncStatus === "ready";

  const {
    claimDaily,
    handleSpawn,
    handleRecoverEnergy,
    handleMerge,
    handleSwap,
    handleSacrificeHybrid,
    handleShopBuy,
    handleLaunchNuke,
    handleClaimTask,
    handleClaimDailyQuest,
    handleResolveHybrid,
    handleHybridWithArt,
  } = useGameHandlers({
    game,
    authenticated,
    serverReady,
    forceSync,
    pullFromServer,
    serverMerge,
    serverSpawn,
    serverSwap,
    serverResolveHybrid,
    serverSacrificeBoardHybrid,
    softRateLimitToast,
    generatedImageUrl,
    setShowDaily,
  });

  void handleClaimTask;
  void handleClaimDailyQuest;

  if (!game.hydrated) {
    return (
      <div className="hud-shell tac-tone-cyan flex min-h-screen flex-col items-center justify-center gap-3">
        <span className="tac-badge"><span aria-hidden className="tac-blink" /> Establishing uplink</span>
        <span className="tac-text font-mono text-sm font-black uppercase">Loading…</span>
      </div>
    );
  }

  return (
    <div className="app-shell hud-shell mx-auto flex max-w-lg flex-col text-foreground">
      <Toaster position="top-center" theme="dark" richColors />
      <TopBar state={game.state} />
      <div className="px-3 pt-2">
        <ApocalypseTicker />
      </div>

      {authenticated && syncStatus !== "ready" && (
        <div className="px-3 pt-1">
          <div className="hud-card px-2.5 py-1 text-center font-mono text-[10px] font-black uppercase tracking-wider text-neon-amber">
            {syncStatus === "hydrating" && "Syncing progress…"}
            {syncStatus === "unavailable" && "Offline mode — local only"}
            {syncStatus === "error" && "Sync issue — will retry"}
            {syncStatus === "idle" && "Connecting…"}
          </div>
        </div>
      )}

      <main className="app-main flex-1 overflow-y-auto px-3 pt-2 pb-20">
        {tab === "play" && (
          <SubTabBar
            tabs={[
              { id: "board" as const, label: "Coin board", icon: LayoutGrid },
              { id: "ops" as const, label: "Operations", icon: ClipboardList },
              { id: "battlefield" as const, label: "Battlefield", icon: Crosshair },
            ]}
            value={warSub}
            onChange={setWarSub}
          />
        )}
        <AnimatePresence mode="wait">
          {tab === "play" && warSub === "board" && (
            <motion.div
              key="play"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-2"
            >
              <PlayTab />
            </motion.div>
          )}

          {tab === "play" && warSub === "ops" && (
            <motion.div
              key="ops"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="space-y-4"
            >
              <OpsTab state={game.state} />
            </motion.div>
          )}

          {tab === "play" && warSub === "battlefield" && (
            <motion.div
              key="battlefield"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              {/* ── ONLY CHANGE: pass onRewardClaimed so TopBar updates after battle ── */}
              <BattlefieldTab
                state={game.state}
                onRewardClaimed={async () => {
                  await forceSync();
                  await pullFromServer();
                }}
              />
            </motion.div>
          )}

          {tab === "world" && (
            <motion.div
              key="world"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <WorldTab
                worldSub={worldSub}
                setWorldSub={setWorldSub}
                state={game.state}
                referralCode={game.state.referralCode}
                onEconomyChange={async () => {
                  await forceSync();
                  await pullFromServer();
                  await refreshLeaderboard();
                }}
                onLaunchNuke={handleLaunchNuke}
              />
            </motion.div>
          )}

          {tab === "earn" && (
            <motion.div
              key="earn"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <EarnTab
                earnSub={earnSub}
                setEarnSub={setEarnSub}
                game={game}
                authenticated={authenticated}
                forceSync={forceSync}
                onShopBuy={handleShopBuy}
              />
            </motion.div>
          )}

          {tab === "base" && (
            <motion.div
              key="base"
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
            >
              <BaseTab
                baseSub={baseSub}
                setBaseSub={setBaseSub}
                state={game.state}
                authenticated={authenticated}
                user={session.user}
              />
            </motion.div>
          )}
          {tab === "season" && (
            <motion.div key="season" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}>
              <SeasonTab state={game.state} leaderboard={leaderboard} myUserId={session.user?.id ?? null} authenticated={authenticated} />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <PrimaryTabBar tab={tab} onChange={setTab} missionsBadge={missionsBadge} />

      <CommandBriefing
        open={showBriefing}
        canClaimDaily={game.canClaimDaily()}
        streak={game.state.dailyStreak}
        onClaimDaily={claimDaily}
        onDeploy={() => {
          closeBriefing();
          setTab("play");
          setWarSub("battlefield");
        }}
        onClose={closeBriefing}
      />

      <GameModals
        game={game}
        showDaily={showDaily}
        setShowDaily={setShowDaily}
        claimDaily={claimDaily}
        showTutorial={showTutorial}
        setShowTutorial={setShowTutorial}
        forceSync={forceSync}
        showCocoonModal={showCocoonModal}
        setShowCocoonModal={setShowCocoonModal}
        showResultModal={showResultModal}
        setShowResultModal={setShowResultModal}
        generatedImageUrl={generatedImageUrl}
        setGeneratedImageUrl={setGeneratedImageUrl}
        handleResolveHybrid={handleResolveHybrid}
        handleHybridWithArt={handleHybridWithArt}
      />
    </div>
  );
}
