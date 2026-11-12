import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Loader2, RefreshCw, Package, Shield } from "lucide-react";
import { TacticalModal } from "@/components/ui/TacticalModal";
import { ActionButton } from "@/components/ActionButton";
import { AssetArt } from "./AssetArt";
import { claimStarterKitFn, equipAssetFn, getMyAssetsFn } from "@/lib/assets/assets.functions";
import { mintAssetFn } from "@/lib/forge.functions";
import {
  EQUIP_SLOTS,
  slotAccepts,
  starterSeeds,
  type AssetKind,
  type EquipSlot,
  type Faction,
  type OwnedAsset,
} from "@/lib/assets/recipe";

const SLOT_LABEL: Record<EquipSlot, string> = { avatar: "Avatar", skin: "Shooter skin", weapon: "Weapon", map: "Map" };
const FILTERS: Array<AssetKind | "all"> = ["all", "character", "weapon", "map"];

export function InventoryPanel({ authenticated }: { authenticated: boolean }) {
  const getAssets = useServerFn(getMyAssetsFn);
  const claimStarter = useServerFn(claimStarterKitFn);
  const equip = useServerFn(equipAssetFn);
  const mint = useServerFn(mintAssetFn);
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [loading, setLoading] = useState(authenticated);
  const [loadError, setLoadError] = useState(false);
  const [available, setAvailable] = useState<boolean | null>(null);
  const [filter, setFilter] = useState<AssetKind | "all">("all");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState<OwnedAsset | null>(null);

  const load = useCallback(async () => {
    setLoadError(false);
    setSelected(null);
    if (!authenticated) { setAvailable(false); setAssets([]); setLoading(false); return; }
    setLoading(true);
    try {
      const res = await getAssets();
      setAvailable(res.available);
      setAssets(res.assets);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getAssets]);

  useEffect(() => {
    void load();
  }, [load]);

  // Preview kit when saving isn't possible (signed out or no database yet).
  const preview = useMemo<OwnedAsset[]>(
    () => starterSeeds("preview", "wardog").map((recipe, i) => ({ id: -(i + 1), recipe, equippedSlot: null, nftAddress: null, status: "preview" })),
    [],
  );
  const list = available === false ? preview : assets;
  const shown = list.filter((a) => filter === "all" || a.recipe.kind === filter);

  async function onClaim(faction: Faction) {
    setBusy(true);
    try {
      const res = await claimStarter({ data: { faction } });
      setAssets(res.assets);
      toast.success("Starter kit added to your arsenal");
    } catch {
      toast.error("Couldn't claim your starter kit. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onEquip(asset: OwnedAsset, slot: EquipSlot) {
    setBusy(true);
    try {
      const res = await equip({ data: { assetId: asset.id, slot } });
      setAssets(res.assets);
      setSelected(null);
      toast.success(`Equipped as ${SLOT_LABEL[slot]}`);
    } catch {
      toast.error("Couldn't equip that item.");
    } finally {
      setBusy(false);
    }
  }

  async function onMint(asset: OwnedAsset) {
    setBusy(true);
    try {
      const res = await mint({ data: { assetId: asset.id } });
      if ("error" in res && res.error) toast.error(res.error);
      else { toast.success("Minting started. Check back for confirmation."); await load(); }
    } catch {
      toast.error("Couldn't start minting.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading arsenal…</div>;
  if (loadError) return <div role="alert" className="space-y-3 py-10 text-center"><p className="text-sm text-muted-foreground">Your arsenal couldn't be loaded.</p><ActionButton onClick={() => void load()}><RefreshCw className="h-4 w-4" /> Retry</ActionButton></div>;

  return (
    <div className="space-y-4 pb-6">
      <div className="grid grid-cols-4 gap-2">
        {EQUIP_SLOTS.map((slot) => {
          const item = list.find((a) => a.equippedSlot === slot);
          return (
            <div key={slot} className="hud-card p-3 text-center">
              <div className="aspect-square overflow-hidden rounded-lg bg-muted">
                {item && <AssetArt recipe={item.recipe} className="h-full w-full" />}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{SLOT_LABEL[slot]}</div>
            </div>
          );
        })}
      </div>

      {available === false && (
        <p className="hud-card p-3 text-xs text-muted-foreground">
          {authenticated ? 'Arsenal is temporarily unavailable.' : 'Preview arsenal · Sign in through Telegram to save and equip items.'}
        </p>
      )}

      {available && assets.length === 0 && (
        <div className="holo-panel holo-scan p-4 text-center">
          <div className="text-sm font-semibold text-foreground">Claim your free starter kit</div>
          <p className="mt-1 text-xs text-muted-foreground">One fighter, one weapon and one battlefield map.</p>
          <div className="mt-3 flex justify-center gap-2">
            {(["wardog", "warcat"] as const).map((f) => (
              <ActionButton
                key={f}
                disabled={busy}
                onClick={() => onClaim(f)}
                className="min-h-11 rounded-lg cta-deploy hit-cta px-4 py-2 text-xs font-bold uppercase text-background disabled:opacity-50"
              >
                {f === "wardog" ? "WarDog" : "WarCat"}
              </ActionButton>
            ))}
          </div>
        </div>
      )}

      <div role="group" aria-label="Item types" className="grid grid-cols-4 gap-1">
        {FILTERS.map((f) => (
          <ActionButton
            key={f}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
            className={`min-h-11 hud-card p-3 text-[11px] font-semibold uppercase ${filter === f ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}
          >
            {f === "all" ? "All" : `${f}s`}
          </ActionButton>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-2">
        {shown.map((a) => (
          <ActionButton
            key={a.id}
            aria-label={`${a.recipe.rarity} ${a.recipe.kind}, tier ${a.recipe.tier}${a.equippedSlot ? ", equipped" : ""}`}
            disabled={!available}
            onClick={() => setSelected(a)}
            className={`min-h-11 hud-card p-3 text-left flex-col gap-0 min-w-0 disabled:opacity-100 ${a.equippedSlot ? "border-neon-cyan" : "border-border"}`}
          >
            <AssetArt recipe={a.recipe} className="aspect-square w-full" />
            <div className="mt-1 flex w-full items-center justify-between text-[10px]">
              <span className="font-semibold uppercase text-foreground">{a.recipe.rarity}</span>
              <span className="text-muted-foreground">T{a.recipe.tier}</span>
            </div>
          </ActionButton>
        ))}
      </div>

      {shown.length === 0 && <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground"><Package className="h-6 w-6" />No {filter === "all" ? "items" : `${filter}s`} yet.</div>}

      <TacticalModal
        open={!!selected}
        onClose={busy ? undefined : () => setSelected(null)}
        tone="cyan"
        badge="Armory"
        badgeIcon={Shield}
        title={selected ? `${selected.recipe.rarity} ${selected.recipe.kind}` : "Item details"}
        sound="none"
        hapticOnOpen="light"
      >
        {selected && (
          <>
            <AssetArt recipe={selected.recipe} className="mx-auto mt-3 h-40 w-40" />
            <div className="mt-2 text-center text-sm font-bold uppercase text-foreground">
              {selected.recipe.rarity} {selected.recipe.faction} {selected.recipe.kind}
            </div>
            <div className="mt-1 text-center text-xs text-muted-foreground">
              ATK {selected.recipe.stats.attack} · DEF {selected.recipe.stats.defense} · SPD {selected.recipe.stats.speed}
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              {EQUIP_SLOTS.filter((s) => slotAccepts(s, selected.recipe.kind)).map((slot) => (
                <ActionButton
                  key={slot}
                  disabled={busy}
                  onClick={() => onEquip(selected, slot)}
                  className="min-h-11 rounded-lg bg-primary px-3 py-2 text-xs font-bold uppercase text-primary-foreground disabled:opacity-50"
                >
                  Equip as {SLOT_LABEL[slot]}
                </ActionButton>
              ))}
            </div>
            <div className="mt-2">
              {selected.nftAddress ? (
                <a
                  href={`https://getgems.io/nft/${selected.nftAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex min-h-11 w-full items-center justify-center rounded-lg border border-primary py-2 text-center text-xs font-bold uppercase text-primary"
                >
                  Sell or transfer on GetGems
                </a>
              ) : (
                <ActionButton
                  disabled={busy}
                  onClick={() => onMint(selected)}
                  className="min-h-11 w-full rounded-lg border border-primary py-2 text-xs font-bold uppercase text-primary disabled:opacity-50"
                >
                  Mint as TON NFT
                </ActionButton>
              )}
            </div>
          </>
        )}
      </TacticalModal>
    </div>
  );
}
