import { useCallback, useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Flame, KeyRound, Sparkles, Trash2, Loader2, RefreshCw } from "lucide-react";
import { ActionButton } from "@/components/ActionButton";
import { TacticalCTA, TacticalModal } from "@/components/ui/TacticalModal";
import { AssetArt } from "@/components/assets/AssetArt";
import { getMyAssetsFn } from "@/lib/assets/assets.functions";
import { craftFn, deletePlayerKeyFn, generateAssetFn, getForgeStatusFn, savePlayerKeyFn } from "@/lib/forge.functions";
import { AI_PROVIDERS, GENERATION_COST, PLAYER_KEY_PROVIDERS, PROMPT_MAX, type AiProviderId } from "@/lib/ai/providers";
import { previewCraft, TIER_NAMES, CRAFT_MAX_INPUTS } from "@/lib/crafting/crafting";
import type { AssetKind, AssetRecipe, Faction, OwnedAsset } from "@/lib/assets/recipe";

const CRAFT_MILESTONES = [1, 5, 25, 100];

export function ForgePanel({ authenticated }: { authenticated: boolean }) {
  const getStatus = useServerFn(getForgeStatusFn);
  const getAssets = useServerFn(getMyAssetsFn);
  const generate = useServerFn(generateAssetFn);
  const craft = useServerFn(craftFn);
  const saveKey = useServerFn(savePlayerKeyFn);
  const delKey = useServerFn(deletePlayerKeyFn);

  const [loading, setLoading] = useState(authenticated);
  const [loadError, setLoadError] = useState(false);
  const [keyBusy, setKeyBusy] = useState(false);
  const [status, setStatus] = useState<{ available: boolean; keys: string[]; storage: boolean; nft: boolean; crafts: number } | null>(null);
  const [assets, setAssets] = useState<OwnedAsset[]>([]);
  const [provider, setProvider] = useState<AiProviderId>("lovable");
  const [kind, setKind] = useState<AssetKind>("character");
  const [faction, setFaction] = useState<Faction>("wardog");
  const [prompt, setPrompt] = useState("");
  const [payToken, setPayToken] = useState<"wardog" | "warcat">("wardog");
  const [busy, setBusy] = useState(false);
  const [generated, setGenerated] = useState<{ recipe: AssetRecipe; storageUri: string } | null>(null);
  const [keyProvider, setKeyProvider] = useState<(typeof PLAYER_KEY_PROVIDERS)[number]>("openrouter");
  const [keyValue, setKeyValue] = useState("");
  const [picked, setPicked] = useState<number[]>([]);
  const [phase, setPhase] = useState<"idle" | "burning" | "reveal">("idle");
  const [crafted, setCrafted] = useState<{ recipe: AssetRecipe; upgraded: boolean } | null>(null);

  const refresh = useCallback(async () => {
    setLoadError(false);
    if (!authenticated) { setAssets([]); setPicked([]); setStatus({ available: false, keys: [], storage: false, nft: false, crafts: 0 }); setLoading(false); return; }
    setLoading(true);
    try {
      const [s, a] = await Promise.all([getStatus(), getAssets()]);
      setStatus(s);
      setAssets(a.assets);
      setPicked((ids) => ids.filter((id) => a.assets.some((asset) => asset.id === id)));
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [authenticated, getStatus, getAssets]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const live = authenticated && !loadError && Boolean(status?.available);
  const actionBusy = busy || keyBusy || phase === "burning";
  const needsKey = provider !== "lovable" && !status?.keys.includes(provider);
  const cost = provider === "lovable" ? GENERATION_COST.platform : GENERATION_COST.ownKey;

  async function onGenerate() {
    setBusy(true);
    setGenerated(null);
    try {
      const res = await generate({ data: { provider, kind, faction, prompt, payToken } });
      if ("error" in res && res.error) toast.error(res.error);
      else if ("asset" in res && res.asset) {
        setGenerated(res.asset);
        toast.success("New item forged and added to your arsenal");
        void refresh();
      }
    } catch {
      toast.error("Generation failed. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function onSaveKey() {
    setKeyBusy(true);
    try {
      const result = await saveKey({ data: { provider: keyProvider, apiKey: keyValue.trim() } });
      if (!result.available) throw new Error("unavailable");
      setKeyValue("");
      toast.success("Key saved securely");
      void refresh();
    } catch {
      toast.error("Couldn't save that key");
    } finally {
      setKeyBusy(false);
    }
  }

  async function onDeleteKey(providerId: (typeof PLAYER_KEY_PROVIDERS)[number]) {
    setKeyBusy(true);
    try {
      const result = await delKey({ data: { provider: providerId } });
      if (!result.available) throw new Error("unavailable");
      toast.success("Key removed");
      await refresh();
    } catch { toast.error("Couldn't remove that key"); }
    finally { setKeyBusy(false); }
  }

  const pickedAssets = assets.filter((a) => picked.includes(a.id));
  const preview = useMemo(() => previewCraft(pickedAssets.map((a) => a.recipe)), [pickedAssets]);
  const craftable = assets.filter((a) => !a.nftAddress);

  async function onCraft() {
    setPhase("burning");
    const started = Date.now();
    try {
      const res = await craft({ data: { assetIds: picked, faction } });
      await new Promise((r) => setTimeout(r, Math.max(0, 900 - (Date.now() - started))));
      if ("error" in res && res.error) {
        toast.error(res.error);
        setPhase("idle");
        return;
      }
      if ("result" in res && res.result) {
        setCrafted(res.result);
        setPhase("reveal");
        setPicked([]);
        void refresh();
      } else {
        toast.error("Crafting could not be confirmed. Refresh your arsenal before trying again.");
        setPhase("idle");
      }
    } catch {
      toast.error("Crafting failed");
      setPhase("idle");
    }
  }

  const nextMilestone = CRAFT_MILESTONES.find((m) => (status?.crafts ?? 0) < m) ?? CRAFT_MILESTONES.at(-1) ?? 100;

  if (loading && !status) return <div role="status" className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading forge…</div>;
  if (loadError) return <div role="alert" className="space-y-3 py-10 text-center"><p className="text-sm text-muted-foreground">The forge couldn't be loaded.</p><ActionButton disabled={loading} onClick={() => void refresh()}><RefreshCw className="h-4 w-4" /> Retry</ActionButton></div>;

  return (
    <div className="space-y-5 pb-8">
      {!live && (
        <p className="hud-card p-3 text-xs text-muted-foreground">
          {authenticated ? 'Forge is temporarily unavailable.' : 'Sign in through Telegram to forge and evolve your items.'}
        </p>
      )}

      {/* Generate */}
      <section className="holo-panel holo-scan p-4">
        <h3 className="flex items-center gap-2 hud-title">
          <Sparkles className="h-4 w-4 text-neon-cyan" /> AI Forge
        </h3>
        <div className="mt-3 grid grid-cols-3 gap-1.5">
          {(["character", "weapon", "map"] as const).map((k) => (
            <ActionButton key={k} onClick={() => setKind(k)} className={`min-h-11 hud-card p-3 text-[11px] font-bold uppercase ${kind === k ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
              {k}
            </ActionButton>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-2 gap-1.5">
          {(["wardog", "warcat"] as const).map((f) => (
            <ActionButton key={f} onClick={() => setFaction(f)} className={`min-h-11 hud-card p-3 text-[11px] font-bold uppercase ${faction === f ? "hud-card-active text-neon-cyan" : "bg-muted text-muted-foreground"}`}>
              {f === "wardog" ? "WarDog" : "WarCat"}
            </ActionButton>
          ))}
        </div>
        <textarea
          aria-label="Item description"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value.slice(0, PROMPT_MAX))}
          placeholder="Describe it: chrome armor, red visor, scarred veteran…"
          rows={3}
          className="mt-2 w-full hud-input min-h-11 p-2 text-sm text-foreground placeholder:text-muted-foreground"
        />
        <div className="mt-2 flex items-center gap-2">
          <select aria-label="AI provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProviderId)} className="min-w-0 flex-1 hud-input min-h-11 p-2 text-xs text-foreground">
            {AI_PROVIDERS.map((p) => (
              <option key={p.id} value={p.id}>{p.label}</option>
            ))}
          </select>
          <select aria-label="Payment token" value={payToken} onChange={(e) => setPayToken(e.target.value as "wardog" | "warcat")} className="hud-input min-h-11 p-2 text-xs text-foreground">
            <option value="wardog">$WARDOG</option>
            <option value="warcat">$WARCAT</option>
          </select>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
          <span>Cost: <b className="text-foreground">{cost}</b> {payToken.toUpperCase()}</span>
          {needsKey && <span className="text-destructive">Add your {provider} key below</span>}
          {live && !status?.storage && <span>Image storage not set up</span>}
        </div>
        <ActionButton
          disabled={!live || !status?.storage || actionBusy || needsKey || prompt.trim().length < 3}
          onClick={onGenerate}
          className="min-h-11 mt-3 w-full rounded-lg cta-deploy hit-cta py-2.5 text-sm font-mono font-black uppercase tracking-wider text-background disabled:opacity-40"
        >
          {busy ? "Forging…" : "Generate"}
        </ActionButton>
        {busy && <div className="progress-track mt-2"><div className="progress-fill w-2/3 animate-pulse" /></div>}
        {generated && (
          <div className="forge-reveal mt-3 flex items-center gap-3 rounded-lg border border-neon-cyan/50 bg-background p-2">
            <img src={generated.storageUri.replace("ipfs://", "https://ipfs.io/ipfs/")} alt="Generated item" className="h-20 w-20 rounded-lg object-cover" />
            <div className="text-xs">
              <div className="font-bold uppercase text-foreground">{generated.recipe.rarity} {generated.recipe.kind}</div>
              <div className="text-muted-foreground">Saved to your arsenal. Mint it from the Arsenal tab.</div>
            </div>
          </div>
        )}
      </section>

      {/* Player keys */}
      <section className="holo-panel p-4">
        <h3 className="flex items-center gap-2 hud-title">
          <KeyRound className="h-4 w-4 text-neon-cyan" /> Your AI accounts
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Use your own OpenRouter, xAI (Grok) or OpenAI key for cheaper forging. Keys are encrypted and never shown again.</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {status?.keys.map((k) => (
            <span key={k} className="flex items-center gap-1 rounded-full bg-secondary px-2 py-1 text-[11px] font-semibold text-foreground">
              {k}
              <ActionButton aria-label={`Remove ${k} key`} title={`Remove ${k} key`} disabled={actionBusy} className="min-h-11 border-0 p-1" onClick={() => void onDeleteKey(k as (typeof PLAYER_KEY_PROVIDERS)[number])}>
                <Trash2 className="h-3 w-3" />
              </ActionButton>
            </span>
          ))}
        </div>
        <div className="mt-2 flex gap-1.5">
          <select aria-label="Key provider" value={keyProvider} onChange={(e) => setKeyProvider(e.target.value as (typeof PLAYER_KEY_PROVIDERS)[number])} className="hud-input min-h-11 p-2 text-xs text-foreground">
            {PLAYER_KEY_PROVIDERS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
          <input aria-label="Provider API key" autoComplete="off" type="password" value={keyValue} onChange={(e) => setKeyValue(e.target.value)} placeholder="Paste API key" className="min-w-0 flex-1 hud-input min-h-11 p-2 text-xs text-foreground" />
          <ActionButton disabled={!live || actionBusy || keyValue.trim().length < 10} onClick={onSaveKey} className="min-h-11 rounded-lg cta-deploy hit-cta px-3 text-xs font-bold text-background disabled:opacity-40">Save</ActionButton>
        </div>
      </section>

      {/* Crafting */}
      <section className="holo-panel p-4">
        <h3 className="flex items-center gap-2 hud-title">
          <Flame className="h-4 w-4 text-neon-cyan" /> Evolution Chamber
        </h3>
        <p className="mt-1 text-xs text-muted-foreground">Burn 3 to {CRAFT_MAX_INPUTS} items (at least one fighter) to evolve a stronger fighter one tier up.</p>
        <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
          <span>Crafts: {status?.crafts ?? 0} / {nextMilestone}</span>
          <span>Next badge</span>
        </div>
        <div className="progress-track mt-1"><div className="progress-fill" style={{ width: `${Math.min(100, ((status?.crafts ?? 0) / nextMilestone) * 100)}%` }} /></div>

        <div className="mt-3 grid grid-cols-4 gap-1.5">
          {craftable.map((a) => {
            const on = picked.includes(a.id);
            return (
              <ActionButton
                key={a.id}
                disabled={!live || actionBusy}
                aria-pressed={on}
                aria-label={`${a.recipe.rarity} ${a.recipe.kind}, tier ${a.recipe.tier}`}
                onClick={() => setPicked((p) => (on ? p.filter((x) => x !== a.id) : p.length < CRAFT_MAX_INPUTS ? [...p, a.id] : p))}
                className={`min-h-11 flex-col gap-0 min-w-0 rounded-lg border p-1 ${on ? "hud-card-active" : "border-border"} ${on && phase === "burning" ? "forge-burn" : ""}`}
              >
                <AssetArt recipe={a.recipe} className="aspect-square w-full" />
                <div className="text-[9px] font-semibold uppercase text-muted-foreground">{a.recipe.rarity} T{a.recipe.tier}</div>
              </ActionButton>
            );
          })}
          {craftable.length === 0 && <p className="col-span-4 text-xs text-muted-foreground">No craftable items yet. Claim your starter kit in the Arsenal.</p>}
        </div>

        <div className="mt-3 rounded-lg bg-background p-3 text-xs">
          <div className="progress-track"><div className="progress-fill" style={{ width: `${preview.progress * 100}%` }} /></div>
          {preview.ok ? (
            <div className="mt-2 text-foreground">
              Result: <b>{TIER_NAMES[preview.targetTier - 1]}</b> {preview.baseRarity} fighter
              {preview.upgradeChance > 0 && <> · <b className="text-neon-cyan">{Math.round(preview.upgradeChance * 100)}%</b> chance of {preview.upgradeRarity}</>}
            </div>
          ) : (
            <div className="mt-2 text-muted-foreground">{preview.reason}</div>
          )}
        </div>
        <ActionButton
          disabled={!live || !preview.ok || actionBusy}
          onClick={onCraft}
          className="min-h-11 mt-3 w-full rounded-lg cta-danger hit-cta py-2.5 text-sm font-mono font-black uppercase tracking-wider text-destructive-foreground disabled:opacity-40"
        >
          {phase === "burning" ? "Burning…" : "Burn & Evolve"}
        </ActionButton>
      </section>

      <TacticalModal
        open={phase === "reveal" && !!crafted}
        onClose={() => setPhase("idle")}
        tone="amber"
        badge="Forge complete"
        badgeIcon={Flame}
        title={crafted ? `${TIER_NAMES[crafted.recipe.tier - 1]} ${crafted.recipe.rarity}` : "Forge complete"}
        sound="victory"
        hapticOnOpen="success"
        align="center"
        footer={
          <TacticalCTA variant="amber" buzz="light" onClick={() => setPhase("idle")}>
            Continue
          </TacticalCTA>
        }
      >
        {crafted && (
          <div className="mt-3 text-center">
            <AssetArt recipe={crafted.recipe} className="forge-reveal mx-auto h-48 w-48" />
            {crafted.upgraded && <div className="mt-2 text-sm font-black neon-text-amber">Rarity jump!</div>}
            <div className="mt-1 text-xs text-muted-foreground">ATK {crafted.recipe.stats.attack} · DEF {crafted.recipe.stats.defense} · SPD {crafted.recipe.stats.speed}</div>
          </div>
        )}
      </TacticalModal>
    </div>
  );
}
