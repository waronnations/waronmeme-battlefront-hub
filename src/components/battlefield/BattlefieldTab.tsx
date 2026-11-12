import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { getMyAssetsFn } from "@/lib/assets/assets.functions";
import { AssetArt } from "@/components/assets/AssetArt";
import type { OwnedAsset } from "@/lib/assets/recipe";
import { motion } from "framer-motion";
import { ShooterCanvas } from "./ShooterCanvas";
import type { BattleMode, Faction, PlayerStats, BattleRewardResult } from "./types";
import type { GameState } from "@/lib/game/types";
import { claimBattleReward } from "@/lib/battle/claimBattleReward.server";
import { LOADOUT, MATCH_SECONDS } from "./constants";

interface Props {
  state: GameState;
  onRewardClaimed?: () => void | Promise<void>;
}

export function BattlefieldTab({ state, onRewardClaimed }: Props) {
  const [inMatch, setInMatch] = useState(false);
  const [mode, setMode] = useState<BattleMode>("hunt");
  const [lastResult, setLastResult] = useState<PlayerStats | null>(null);
  const [lastReward, setLastReward] = useState<BattleRewardResult | null>(null);
  const [claiming, setClaiming] = useState(false);

  const getAssets = useServerFn(getMyAssetsFn);
  const [equipped, setEquipped] = useState<OwnedAsset[]>([]);
  useEffect(() => {
    getAssets()
      .then((r) => setEquipped(r.assets.filter((a) => a.equippedSlot)))
      .catch(() => setEquipped([]));
  }, [getAssets]);
  const skin = equipped.find((a) => a.equippedSlot === "skin");
  const weapon = equipped.find((a) => a.equippedSlot === "weapon");
  const map = equipped.find((a) => a.equippedSlot === "map");

  const playerFaction: Faction =
    skin?.recipe.faction ??
    ((state.wardogTokens ?? 0) >= (state.warcatTokens ?? 0) ? "wardog" : "warcat");
  // Equipped gear adds a small, capped bonus on top of rank.
  const gearBonus = Math.min(5, Math.floor(((weapon?.recipe.stats.attack ?? 0) + (skin?.recipe.stats.defense ?? 0)) / 40));
  const rankBonus = Math.floor((state.highestTier ?? 1) / 2) + gearBonus;
  const gun = LOADOUT[playerFaction];

  const handleMatchEnd = async (stats: PlayerStats) => {
    setLastResult(stats);
    setInMatch(false);
    setClaiming(true);
    setLastReward(null);
    try {
      const reward = await claimBattleReward({
        data: {
          kills: stats.kills,
          deaths: stats.deaths,
          damageDealt: stats.damageDealt ?? 0,
          survived: stats.survived ?? false,
          durationSec: Math.round(stats.durationSec || MATCH_SECONDS),
          faction: playerFaction,
          highestTier: state.highestTier ?? 1,
          shotsFired: stats.shotsFired,
          hits: stats.hits,
          mode: stats.mode,
        },
      });
      setLastReward(reward);
      if (onRewardClaimed) await onRewardClaimed();
    } catch (err) {
      console.error("Battle reward claim failed", err);
      setLastReward(null);
    } finally {
      setClaiming(false);
    }
  };

  if (inMatch) {
    return (
      <ShooterCanvas
        playerFaction={playerFaction}
        rankBonus={rankBonus}
        mode={mode}
        onMatchEnd={handleMatchEnd}
        onExit={() => setInMatch(false)}
      />
    );
  }

  return (
    <div className="space-y-5 pb-8">
      <div className="flex items-center justify-between">
        <h2 className="hud-title flex items-center gap-2">BATTLEFIELD</h2>
        <div className="text-xs text-muted-foreground font-medium">
          {gun.name} • Rank +{rankBonus * 6} HP
        </div>
      </div>

      {(skin || weapon || map) && (
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Skin", a: skin },
            { label: "Weapon", a: weapon },
            { label: "Map", a: map },
          ].map(({ label, a }) => (
            <div key={label} className="hud-card p-1.5 text-center">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                {a && <AssetArt recipe={a.recipe} className="h-full w-full" />}
              </div>
              <div className="mt-1 hud-label text-[10px] text-muted-foreground">{label}</div>
            </div>
          ))}
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        className="holo-panel holo-scan p-4 text-center space-y-5 "
      >
        <p className="text-foreground text-sm leading-relaxed">
          Drop in as{" "}
          <span className={`font-black ${playerFaction === "wardog" ? "text-destructive" : "text-neon-cyan"}`}>{playerFaction.toUpperCase()}</span>
          . Hold fire. Hunt the other color. {MATCH_SECONDS}s rounds.
        </p>

        <div className="grid grid-cols-3 gap-2">
          {([
            ["hunt", "HUNT"],
            ["waves", "WAVES"],
            ["hold", "HOLD"],
          ] as const).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setMode(id)}
              className={`min-h-11 rounded-xl py-2 text-[0.65rem] font-black tracking-widest ${
                mode === id
                  ? "hud-card-active text-neon-cyan"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="text-[0.65rem] text-muted-foreground">
          {mode === "hunt" && "Only opposite-faction bots count as kills."}
          {mode === "waves" && "3 waves. Clear them all to victory."}
          {mode === "hold" && "Stand on the center crate to score. Survive the clock."}
        </p>

        {lastResult && (
          <div className="text-sm space-y-1">
            <div className="text-neon-green font-semibold">
              Last: {lastResult.kills} kills • {lastResult.accuracy}% acc •{" "}
              {lastResult.durationSec}s
              {lastResult.survived ? " • Victory" : ""}
            </div>
            {claiming && <div className="text-xs text-muted-foreground">Claiming rewards…</div>}
            {lastReward && !claiming && (
              <div className="text-xs text-foreground font-medium">{lastReward.message}</div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={() => setInMatch(true)}
          className="min-h-11 hit-cta cta-deploy w-full py-4 text-lg transition active:scale-[0.98]"
        >
          ENTER {mode.toUpperCase()}
        </button>
      </motion.div>
    </div>
  );
}
