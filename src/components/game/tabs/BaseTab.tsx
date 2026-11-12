// src/components/game/tabs/BaseTab.tsx
import { User, Swords, Sparkles } from "lucide-react";
import { ForgePanel } from "@/components/forge/ForgePanel";
import { InventoryPanel } from "@/components/assets/InventoryPanel";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { ProfilePanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";
import type { SessionUser } from "@/hooks/use-telegram-session";

export type BaseSub = "profile" | "arsenal" | "forge";

export function BaseTab({
  baseSub,
  setBaseSub,
  state,
  authenticated,
  user,
}: {
  baseSub: BaseSub;
  setBaseSub: (v: BaseSub) => void;
  state: GameState;
  authenticated: boolean;
  user?: SessionUser | null;
}) {
  return (
    <>
      <TabHero tab="base" />
      <SubTabBar
        tabs={[
          { id: "profile" as const, label: "Profile", icon: User },
          { id: "arsenal" as const, label: "Arsenal", icon: Swords },
          { id: "forge" as const, label: "Forge", icon: Sparkles },
        ]}
        value={baseSub}
        onChange={setBaseSub}
      />
      {baseSub === "forge" ? (
        <ForgePanel authenticated={authenticated} />
      ) : baseSub === "arsenal" ? (
        <InventoryPanel authenticated={authenticated} />
      ) : (
        <ProfilePanel
          state={state}
          user={user}
          authenticated={authenticated}
        />
      )}
    </>
  );
}
