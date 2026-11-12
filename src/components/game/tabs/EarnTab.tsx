// src/components/game/tabs/EarnTab.tsx
import { useCallback, useEffect, useState } from "react";
import { ShoppingBag, Wallet, Users, Package, Vault, ArrowLeftRight } from "lucide-react";
import { QuickSwapPanel } from "@/components/dex/QuickSwapPanel";
import { WarVaultPanel } from "@/components/vault/WarVaultPanel";
import { PacksPanel } from "@/components/packs/PacksPanel";
import { TabHero } from "@/components/game/TabHero";
import { SubTabBar } from "@/components/game/SubTabBar";
import { ShopPanel } from "@/components/ShopPanel";
import {
  ClaimPanel,
  type ClaimBalanceSyncPayload,
} from "@/components/ClaimPanel";
import { ReferralPanel } from "@/components/Panels";
import { type useGame, SHOP_ITEMS } from "@/lib/game-state";
import { getTopupSnapshot } from "@/lib/topups.functions";
import { getClaims } from "@/lib/claims.functions";

export type EarnSub = "vault" | "swap" | "shop" | "claim" | "recruit" | "packs";
export type PayToken = "wardog" | "warcat";

type PoolBalances = {
  spendableWardog: number;
  spendableWarcat: number;
  claimedWardog: number;
  claimedWarcat: number;
};

const EMPTY_POOLS: PoolBalances = {
  spendableWardog: 0,
  spendableWarcat: 0,
  claimedWardog: 0,
  claimedWarcat: 0,
};

export function EarnTab({
  earnSub,
  setEarnSub,
  game,
  authenticated,
  forceSync,
  onShopBuy,
}: {
  earnSub: EarnSub;
  setEarnSub: (v: EarnSub) => void;
  game: ReturnType<typeof useGame>;
  authenticated: boolean;
  forceSync: () => Promise<unknown>;
  onShopBuy: (
    itemId: keyof typeof SHOP_ITEMS,
    payWith: PayToken,
  ) => void | Promise<void>;
}) {
  const { state } = game;
  const [pools, setPools] = useState<PoolBalances>(EMPTY_POOLS);

  const refreshPools = useCallback(async () => {
    if (!authenticated) {
      setPools(EMPTY_POOLS);
      return;
    }
    try {
      const [topup, claims] = await Promise.all([
        getTopupSnapshot(),
        getClaims(),
      ]);

      const spendableWardog = Number(topup?.spendable?.spendableWardog ?? 0);
      const spendableWarcat = Number(topup?.spendable?.spendableWarcat ?? 0);

      let claimedWardog = 0;
      let claimedWarcat = 0;
      if (claims && "claimed" in claims) {
        claimedWardog = Number(claims.claimed?.wardog ?? 0);
        claimedWarcat = Number(claims.claimed?.warcat ?? 0);
      }

      setPools({
        spendableWardog,
        spendableWarcat,
        claimedWardog,
        claimedWarcat,
      });
    } catch {
      /* offline */
    }
  }, [authenticated]);

  useEffect(() => {
    void refreshPools();
  }, [refreshPools, earnSub]);

  const handleClaimBalanceSync = (payload: ClaimBalanceSyncPayload) => {
    game.applyServerEconomy({
      wardogTokens: payload.wardogTokens,
      warcatTokens: payload.warcatTokens,
    });
    setPools((prev) => ({
      ...prev,
      claimedWardog: Number(payload.claimedWardog ?? prev.claimedWardog),
      claimedWarcat: Number(payload.claimedWarcat ?? prev.claimedWarcat),
    }));
    void refreshPools();
  };

  const handleShopBuy = async (
    itemId: keyof typeof SHOP_ITEMS,
    payWith: PayToken,
  ) => {
    await onShopBuy(itemId, payWith);
    void refreshPools();
  };

  return (
    <>
      <TabHero tab="earn" />
      <SubTabBar
        tabs={[
          { id: "vault" as const, label: "Vault", icon: Vault },
          { id: "swap" as const, label: "Swap", icon: ArrowLeftRight },
          { id: "shop" as const, label: "Shop", icon: ShoppingBag },
          { id: "claim" as const, label: "Claim", icon: Wallet },
          { id: "recruit" as const, label: "Recruit", icon: Users },
          { id: "packs" as const, label: "Packs", icon: Package },
        ]}
        value={earnSub}
        onChange={setEarnSub}
      />
      {earnSub === "vault" && <WarVaultPanel authenticated={authenticated} />}
      {earnSub === "swap" && <QuickSwapPanel />}
      {earnSub === "packs" && <PacksPanel authenticated={authenticated} />}
      {earnSub === "shop" && (
        <ShopPanel
          state={state}
          onBuy={handleShopBuy}
          spendableWardog={pools.spendableWardog}
          spendableWarcat={pools.spendableWarcat}
          claimedWardog={pools.claimedWardog}
          claimedWarcat={pools.claimedWarcat}
        />
      )}
      {earnSub === "claim" && (
        <ClaimPanel
          state={state}
          authenticated={authenticated}
          onBalanceSync={handleClaimBalanceSync}
        />
      )}
      {earnSub === "recruit" && (
        <ReferralPanel
          state={state}
          authenticated={authenticated}
          onCodeSync={(code) => {
            // Only patch referralCode — do not replace whole state snapshot
            game.hydrate({ ...game.state, referralCode: code });
          }}
          onServerReward={(json) => {
            try {
              const parsed = JSON.parse(json) as typeof state;
              game.applyServerState(parsed);
              void forceSync();
            } catch {
              /* ignore */
            }
          }}
        />
      )}
    </>
  );
}
