// src/components/ShopPanel.tsx
/**
 * Shop UI
 * - energyPack + gloryBoost + nukePack + gifts: topped-up spendable only.
 * - Board energy recover (on the merge board) uses unclaimed playable only.
 * - Merge board itself never spends tokens (energy only).
 */
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  Zap,
  Flame,
  Bomb,
  ShoppingCart,
  RefreshCw,
  Wallet,
  Gift,
} from "lucide-react";
import { toast } from "sonner";
import type { GameState } from "@/lib/game-state";
import { SHOP_ITEMS, SHOP_ACTION, type ShopItemId } from "@/lib/constants";
import { GIFT_BOXES } from "@/lib/constants/gifts";
import { haptic } from "@/lib/telegram";
import { listNationsFn, buyNationFn } from "@/lib/nations.functions";
import { usePayments } from "@/components/payments/PaymentProvider";

export type PayToken = "wardog" | "warcat";

type ListedNation = {
  id: number;
  name: string;
  tag: string;
  emblem?: string | null;
  listedPrice: number | null;
  memberCount: number;
  isDefault?: boolean;
};

/** Nothing in the shop uses unclaimed. All shop items are topped-up only. */
const PLAYABLE_ITEMS = new Set<ShopItemId>([]);

const POWERUP_IDS: ShopItemId[] = ["energyPack", "gloryBoost", "nukePack"];
const GIFT_IDS: ShopItemId[] = [
  "gift_common",
  "gift_wardog",
  "gift_warcat",
  "gift_nuke",
  "gift_legendary",
];

const ITEM_META: Record<
  string,
  { icon?: typeof Zap; color: string; border: string; bg: string; img?: string }
> = {
  energyPack: {
    icon: Zap,
    color: "text-neon-cyan",
    border: "border-neon-cyan/40",
    bg: "bg-neon-cyan/10",
  },
  gloryBoost: {
    icon: Flame,
    color: "text-neon-amber",
    border: "border-neon-amber/40",
    bg: "bg-neon-amber/30",
  },
  nukePack: {
    icon: Bomb,
    color: "text-destructive",
    border: "border-destructive/40",
    bg: "bg-destructive/10",
  },
  gift_common: {
    color: "text-neon-amber",
    border: "border-neon-amber/40",
    bg: "bg-neon-amber/20",
    img: GIFT_BOXES.common.closedImg,
  },
  gift_wardog: {
    color: "text-destructive",
    border: "border-destructive/40",
    bg: "bg-destructive/20",
    img: GIFT_BOXES.wardog.closedImg,
  },
  gift_warcat: {
    color: "text-neon-cyan",
    border: "border-neon-cyan/40",
    bg: "bg-neon-cyan/20",
    img: GIFT_BOXES.warcat.closedImg,
  },
  gift_nuke: {
    color: "text-neon-green",
    border: "border-neon-green/40",
    bg: "bg-neon-green/20",
    img: GIFT_BOXES.nuke.closedImg,
  },
  gift_legendary: {
    color: "text-neon-amber",
    border: "border-neon-amber/40",
    bg: "bg-neon-amber/20",
    img: GIFT_BOXES.legendary.closedImg,
  },
};

function fmt(n: number): string {
  if (!Number.isFinite(n)) return "0";
  return n >= 10 ? n.toFixed(1) : n.toFixed(2);
}

export function ShopPanel({
  state,
  onBuy,
  /** Optional top-up balances from parent (ClaimPanel / topups API) */
  spendableWardog = 0,
  spendableWarcat = 0,
  claimedWardog = 0,
  claimedWarcat = 0,
}: {
  state: GameState;
  onBuy: (itemId: ShopItemId, payWith: PayToken) => Promise<void> | void;
  spendableWardog?: number;
  spendableWarcat?: number;
  claimedWardog?: number;
  claimedWarcat?: number;
}) {
  const { pay, connected, address, disconnectWallet } = usePayments();
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [listed, setListed] = useState<ListedNation[]>([]);
  const [loadingNations, setLoadingNations] = useState(true);
  const [buyingKey, setBuyingKey] = useState<string | null>(null);

  const totalW = Number(state.wardogTokens ?? 0);
  const totalC = Number(state.warcatTokens ?? 0);

  // Unclaimed playable = ledger total − already claimed (cannot go below 0)
  // Used only for display / board recover (not for shop purchases)
  const playableW = Math.max(0, totalW - Number(claimedWardog ?? 0));
  const playableC = Math.max(0, totalC - Number(claimedWarcat ?? 0));

  const loadMarketplace = async () => {
    setLoadingNations(true);
    try {
      const list = await listNationsFn();
      setListed(
        (list as ListedNation[]).filter(
          (n) =>
            !n.isDefault &&
            n.listedPrice != null &&
            Number(n.listedPrice) > 0,
        ),
      );
    } catch {
      /* silent */
    } finally {
      setLoadingNations(false);
    }
  };

  useEffect(() => {
    void loadMarketplace();
  }, []);

  const balanceForItem = useMemo(() => {
    return (itemId: ShopItemId, payWith: PayToken) => {
      // All shop items (including energyPack) use topped-up spendable
      if (payWith === "wardog") {
        return spendableWardog > 0 ? spendableWardog : totalW;
      }
      return spendableWarcat > 0 ? spendableWarcat : totalC;
    };
  }, [spendableWardog, spendableWarcat, totalW, totalC]);

  const handleShopBuy = async (itemId: ShopItemId, payWith: PayToken) => {
    if (busyKey) return;
    const item = SHOP_ITEMS[itemId];
    const balance = balanceForItem(itemId, payWith);

    if (balance < item.cost - 0.001) {
      toast.error(
        payWith === "wardog"
          ? "Not enough topped-up $WARDOG — use Top Up"
          : "Not enough topped-up $WARCAT — use Top Up",
      );
      return;
    }

    setBusyKey(`${itemId}:${payWith}`);
    try {
      const auth = await pay(SHOP_ACTION[itemId]);
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await onBuy(itemId, payWith);
      haptic("heavy");
      toast.success(`${item.name} purchased!`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("insufficient_spendable")) {
        toast.error("Need topped-up balance — use Top Up");
      } else if (msg.includes("insufficient_playable")) {
        // Should never happen for shop items now
        toast.error("Need topped-up balance — use Top Up");
      } else {
        toast.error("Purchase failed");
      }
    } finally {
      setBusyKey(null);
    }
  };

  const handleBuyNation = async (nation: ListedNation, payWith: PayToken) => {
    if (buyingKey || !nation.listedPrice) return;
    const price = Number(nation.listedPrice);
    const balance =
      payWith === "wardog"
        ? spendableWardog > 0
          ? spendableWardog
          : totalW
        : spendableWarcat > 0
          ? spendableWarcat
          : totalC;
    if (balance < price - 0.001) {
      toast.error(
        payWith === "wardog"
          ? "Not enough $WARDOG (prefer topped-up)"
          : "Not enough $WARCAT (prefer topped-up)",
      );
      return;
    }

    const key = `${nation.id}:${payWith}`;
    setBuyingKey(key);
    try {
      const auth = await pay("nation:buy");
      if (!auth.ok) {
        if (auth.reason !== "cancelled") {
          toast.error("Wallet authorization required");
        }
        return;
      }
      await buyNationFn({ data: { nationId: nation.id, payWith } });
      toast.success(
        `Bought ${nation.name} with $${payWith === "wardog" ? "WARDOG" : "WARCAT"}`,
      );
      haptic("heavy");
      await loadMarketplace();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (
        msg.includes("insufficient_tokens") ||
        msg.includes("insufficient_spendable")
      )
        toast.error("Not enough tokens / top-up");
      else if (msg.includes("not_for_sale")) toast.error("No longer for sale");
      else if (msg.includes("must_leave_current_nation"))
        toast.error("Leave your current nation first");
      else toast.error("Purchase failed");
    } finally {
      setBuyingKey(null);
    }
  };

  const renderItem = (id: ShopItemId) => {
    const item = SHOP_ITEMS[id];
    const meta = ITEM_META[id] || {
      color: "text-foreground",
      border: "border-border",
      bg: "bg-secondary",
    };
    const balW = balanceForItem(id, "wardog");
    const balC = balanceForItem(id, "warcat");

    return (
      <motion.div
        key={id}
        layout
        className={`hud-card p-3 ${meta.border} ${meta.bg}`}
      >
        <div className="flex items-start gap-3">
          <div
            className={`grid h-11 w-11 place-items-center overflow-hidden rounded-xl bg-background/40 ${meta.color}`}
          >
            {meta.img ? (
              <img
                src={meta.img}
                alt={item.name}
                className="h-9 w-9 object-contain"
              />
            ) : meta.icon ? (
              <meta.icon className="h-5 w-5" />
            ) : (
              <Gift className="h-5 w-5" />
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm font-mono font-black text-foreground">{item.name}</div>
            <div className="text-xs text-muted-foreground">{item.desc}</div>
            <div className="mt-1 hud-label">
              Cost · {item.cost} of one token · topped-up only
            </div>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!!busyKey || balW < item.cost - 0.001}
            onClick={() => void handleShopBuy(id, "wardog")}
            className="min-h-11 flex items-center justify-center gap-1.5 rounded-xl border border-destructive/50 bg-destructive/10 py-2.5 text-[0.7rem] font-black uppercase tracking-wider text-destructive disabled:opacity-40"
          >
            {busyKey === `${id}:wardog` ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            $WARDOG · {item.cost}
          </button>
          <button
            type="button"
            disabled={!!busyKey || balC < item.cost - 0.001}
            onClick={() => void handleShopBuy(id, "warcat")}
            className="min-h-11 flex items-center justify-center gap-1.5 rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 py-2.5 text-[0.7rem] font-black uppercase tracking-wider text-neon-cyan disabled:opacity-40"
          >
            {busyKey === `${id}:warcat` ? (
              <RefreshCw className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            $WARCAT · {item.cost}
          </button>
        </div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Balance legend */}
      <div className="hud-card p-3 text-[0.65rem] leading-relaxed text-muted-foreground">
        <div className="mb-1 font-black uppercase tracking-wider text-foreground">
          Token pools
        </div>
        <div>
          Unclaimed (board recover only):{" "}
          <span className="text-neon-cyan">
            {fmt(playableW)} $WARDOG · {fmt(playableC)} $WARCAT
          </span>
        </div>
        <div>
          Topped-up (shop / OPS / energy pack):{" "}
          <span className="text-neon-amber">
            {fmt(spendableWardog)} $WARDOG · {fmt(spendableWarcat)} $WARCAT
          </span>
        </div>
        <div className="mt-1 text-muted-foreground">
          Merging stays free (energy only). Board recharge uses unclaimed
          earnings. Everything in the shop (including Energy Pack) uses
          topped-up balance.
        </div>
      </div>

      {/* Wallet status */}
      <div className="flex items-center justify-between hud-card p-3">
        <div className="flex min-w-0 items-center gap-2">
          <Wallet
            className={`h-4 w-4 shrink-0 ${connected ? "text-neon-green" : "text-muted-foreground"}`}
          />
          <div className="min-w-0">
            <div className="text-[0.65rem] font-black uppercase tracking-wider text-muted-foreground">
              {connected ? "Wallet connected" : "Wallet required for shop"}
            </div>
            <div className="truncate font-mono text-[0.65rem] text-muted-foreground">
              {connected && address
                ? `${address.slice(0, 6)}…${address.slice(-4)}`
                : "Connect when you buy — stays until you disconnect"}
            </div>
          </div>
        </div>
        {connected && (
          <button
            type="button"
            onClick={() => void disconnectWallet()}
            className="min-h-11 shrink-0 rounded-lg border border-border px-2 py-1 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground hover:border-border hover:text-foreground"
          >
            Disconnect
          </button>
        )}
      </div>

      {/* Power-ups (energyPack is now here — topped-up) */}
      <div className="holo-panel p-4">
        <h3 className="mb-2 hud-title text-muted-foreground">
          <Zap className="h-4 w-4 text-neon-cyan" /> Power-ups · topped-up
        </h3>
        <div className="space-y-3">{POWERUP_IDS.map(renderItem)}</div>
      </div>

      {/* Gift Boxes */}
      <div className="holo-panel p-4">
        <h3 className="mb-2 hud-title text-muted-foreground">
          <Gift className="h-4 w-4 text-neon-amber" /> Supply Drops · topped-up
        </h3>
        <div className="space-y-3">{GIFT_IDS.map(renderItem)}</div>
      </div>

      {/* Nations marketplace */}
      <div className="holo-panel p-4">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="hud-title text-muted-foreground">
            <ShoppingCart className="h-4 w-4 text-neon-cyan" /> Nations for sale
          </h3>
          <button
            type="button"
            onClick={() => void loadMarketplace()}
            className="min-h-11 text-[0.6rem] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
          >
            Refresh
          </button>
        </div>
        {loadingNations ? (
          <div className="rounded-xl border border-border py-8 text-center text-xs text-muted-foreground">
            Loading marketplace…
          </div>
        ) : listed.length === 0 ? (
          <div className="rounded-xl border border-border py-8 text-center text-xs text-muted-foreground">
            No nations listed right now
          </div>
        ) : (
          <div className="space-y-3">
            {listed.map((n) => (
              <div
                key={n.id}
                className="hud-card p-3"
              >
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary text-xl">
                    {n.emblem || "🏳️"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-mono font-black text-foreground">
                      {n.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      [{n.tag}] · {n.memberCount} members · {n.listedPrice}{" "}
                      tokens
                    </div>
                  </div>
                  <ShoppingCart className="h-4 w-4 shrink-0 text-neon-cyan" />
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={
                      !!buyingKey || totalW < Number(n.listedPrice) - 0.001
                    }
                    onClick={() => void handleBuyNation(n, "wardog")}
                    className="min-h-11 rounded-xl border border-destructive/50 bg-destructive/10 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-destructive disabled:opacity-40"
                  >
                    {buyingKey === `${n.id}:wardog`
                      ? "…"
                      : `$WARDOG · ${n.listedPrice}`}
                  </button>
                  <button
                    type="button"
                    disabled={
                      !!buyingKey || totalC < Number(n.listedPrice) - 0.001
                    }
                    onClick={() => void handleBuyNation(n, "warcat")}
                    className="min-h-11 rounded-xl border border-neon-cyan/50 bg-neon-cyan/10 py-2.5 text-[0.65rem] font-black uppercase tracking-wider text-neon-cyan disabled:opacity-40"
                  >
                    {buyingKey === `${n.id}:warcat`
                      ? "…"
                      : `$WARCAT · ${n.listedPrice}`}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
