// src/components/game/tabs/WorldTab.tsx
import { Flag, Crosshair, Skull, Crown } from "lucide-react";
import { WarRoomPanel } from "@/components/war-cycle/WarRoomPanel";
import { WealthPanel } from "@/components/war-cycle/WealthPanel";
import { TerritoryRadar } from "@/components/vault/TerritoryRadar";
import { WarChestTicker } from "@/components/vault/WarChestTicker";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { NationsPanel } from "@/components/NationsPanel";
import { NukePanel } from "@/components/NukePanel";
import type { GameState } from "@/lib/game-state";

export type WorldSub = "nations" | "strike" | "warroom" | "wealth";

export function WorldTab({
  worldSub,
  setWorldSub,
  state,
  referralCode,
  onEconomyChange,
  onLaunchNuke,
}: {
  worldSub: WorldSub;
  setWorldSub: (v: WorldSub) => void;
  state: GameState;
  referralCode: string;
  onEconomyChange: () => Promise<void>;
  onLaunchNuke: (targetNationId: number) => Promise<any>;
}) {
  return (
    <>
      <TabHero tab="world" />
      <SubTabBar
        tabs={[
          { id: "nations" as const, label: "Nations", icon: Flag },
          { id: "strike" as const, label: "Strike", icon: Crosshair },
          { id: "warroom" as const, label: "War Room", icon: Skull },
          { id: "wealth" as const, label: "Wealth", icon: Crown },
        ]}
        value={worldSub}
        onChange={setWorldSub}
      />
      {worldSub === "warroom" ? (
        <div className="space-y-4">
          <WarChestTicker compact />
          <TerritoryRadar />
          <WarRoomPanel authenticated={true} />
        </div>
      ) : worldSub === "wealth" ? (
        <WealthPanel />
      ) : worldSub === "nations" ? (
        <NationsPanel
          referralCode={referralCode}
          onEconomyChange={onEconomyChange}
        />
      ) : (
        <NukePanel state={state} onLaunch={onLaunchNuke} />
      )}
    </>
  );
}
