// Public War Room: view-only spectator console. No login, no admin tools.
import { createFileRoute, ClientOnly, Link } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Bot, Crosshair, Radiation, Share2, Shield, Volume2, VolumeX } from "lucide-react";
import { toast, Toaster } from "sonner";
import { getWarRoomFn } from "@/lib/war-room.functions";
import { getCurrentUser } from "@/lib/auth.functions";
import { useCachedQuery } from "@/lib/cache/use-cached";
import { buildReferralLink, REFERRAL_BOT } from "@/lib/referrals.shared";
import { haptic, hapticNotify } from "@/lib/telegram";
import { WarAudio } from "@/components/war-room/war-audio";
import { renderIntelCard, shareIntel } from "@/components/war-room/intel-card";
import { AgentConnectModal } from "@/components/war-room/AgentConnectModal";
import { cn } from "@/lib/utils";

const WarGlobe = lazy(() => import("@/components/war-room/WarGlobe"));

export const Route = createFileRoute("/war-room")({
  head: () => ({
    meta: [
      { title: "War Room — Live Memecoin Battlefield | War On Memes" },
      { name: "description", content: "Spectate the memecoin war live: sector dominance for UTYA, WARDOG, WARCAT and GRAM, radiation levels, combat feed and the Doomsday countdown." },
      { property: "og:title", content: "War Room — Live Memecoin Battlefield" },
      { property: "og:description", content: "Live 3D war room: who controls the sectors, how hot the radiation runs and how long until Doomsday." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: WarRoomPage,
});

const fmtUsd = (n: number) => (n >= 1e9 ? `$${(n / 1e9).toFixed(2)}B` : n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(0)}K` : `$${n.toFixed(0)}`);
const pad = (n: number) => String(n).padStart(2, "0");
const DOT = ["bg-neon-cyan", "bg-neon-amber", "bg-neon-green", "bg-destructive"];

function useNow() {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    setNow(Date.now());
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return now;
}

function WarRoomPage() {
  const get = useServerFn(getWarRoomFn);
  const me = useServerFn(getCurrentUser);
  const { data, loading } = useCachedQuery("warroom:snapshot", 60_000, () => get(), { refreshMs: 30_000 });
  const [user, setUser] = useState<{ username: string | null; firstName: string | null; referralCode: string } | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [muted, setMuted] = useState(true);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const audio = useRef<WarAudio | null>(null);
  const now = useNow();

  useEffect(() => {
    me().then((u) => u && setUser(u)).catch(() => undefined);
  }, [me]);

  const radiation = data?.radiation.level ?? 0;
  useEffect(() => audio.current?.setLevel(radiation), [radiation]);
  useEffect(() => () => audio.current?.stop(), []);

  function toggleAudio() {
    haptic("light");
    if (muted) {
      audio.current ??= new WarAudio();
      audio.current.start(radiation);
      setMuted(false);
    } else {
      audio.current?.stop();
      audio.current = null;
      setMuted(true);
    }
  }

  const msLeft = data && now !== null ? Math.max(0, data.timer.msLeft - (now - data.generatedAt)) : null;
  const countdown = useMemo(() => {
    if (msLeft === null) return "--d --:--:--";
    const s = Math.floor(msLeft / 1000);
    return `${Math.floor(s / 86400)}d ${pad(Math.floor((s % 86400) / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  }, [msLeft]);

  const sectors = data?.sectors ?? [];
  const sel = sectors.find((s) => s.id === selected) ?? null;

  async function share() {
    if (!data) return;
    setSharing(true);
    try {
      const callsign = user?.username ?? user?.firstName ?? "Spectator";
      const link = user ? buildReferralLink(user.referralCode) : `https://t.me/${REFERRAL_BOT}`;
      const blob = await renderIntelCard({
        callsign,
        referralLink: link,
        radiation,
        doomsday: countdown,
        sectors: sectors.map((s) => ({ symbol: s.symbol, dominance: s.dominance, volume24hUsd: s.volume24hUsd })),
        apex: data.timer.survivors[0]?.symbol ?? null,
      });
      const how = await shareIntel(blob, `Battle intel from the War Room. Enlist: ${link}`);
      hapticNotify("success");
      toast.success(how === "shared" ? "Intel shared" : "Intel card saved — post it to your Story");
    } catch {
      hapticNotify("error");
      toast.error("Couldn't build the intel card");
    } finally {
      setSharing(false);
    }
  }

  return (
    <main className="min-h-screen bg-background pb-10 text-foreground">
      <Toaster theme="dark" position="top-center" />
      <header className="sticky top-0 z-20 flex items-center justify-between gap-2 border-b border-border bg-background/85 px-4 py-3 backdrop-blur">
        <div>
          <div className="hud-label">Spectator console · view only</div>
          <h1 className="hud-title text-base">
            <Crosshair className="h-4 w-4 text-neon-cyan" /> War Room
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button type="button" onClick={toggleAudio} aria-label={muted ? "Turn sound on" : "Mute sound"} className="hud-chip min-h-9 text-neon-cyan">
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setAgentsOpen(true)} className="hud-chip min-h-9 text-neon-amber">
            <Bot className="h-4 w-4" /> Agents
          </button>
        </div>
      </header>

      <section className="relative mx-auto h-[52vh] max-h-[520px] min-h-[320px] max-w-3xl">
        <ClientOnly fallback={<div className="grid h-full place-items-center hud-label">Booting holo-globe…</div>}>
          <Suspense fallback={<div className="grid h-full place-items-center hud-label">Booting holo-globe…</div>}>
            <WarGlobe sectors={sectors} radiation={radiation} selected={selected} onSelect={(id) => (haptic("light"), setSelected(id))} />
          </Suspense>
        </ClientOnly>
        <div className="pointer-events-none absolute inset-x-4 top-3 flex justify-between">
          <div className="holo-panel px-3 py-2">
            <div className="hud-label">Doomsday</div>
            <div className="font-mono text-sm font-black text-destructive">{countdown}</div>
          </div>
          <div className="holo-panel px-3 py-2 text-right">
            <div className="hud-label">Radiation</div>
            <div className={cn("flex items-center justify-end gap-1 font-mono text-sm font-black", radiation >= 50 ? "text-destructive" : "text-neon-green")}>
              <Radiation className="h-3.5 w-3.5" /> {loading ? "--" : `${radiation}%`}
            </div>
          </div>
        </div>
        {sel && (
          <div className="absolute inset-x-4 bottom-3 holo-panel px-3 py-2">
            <div className="flex items-center justify-between">
              <span className="hud-title">${sel.symbol} sector</span>
              <span className="hud-chip text-neon-amber">{Math.round(sel.dominance * 100)}% control</span>
            </div>
            <div className="mt-1 grid grid-cols-3 gap-2 text-xs">
              <div><div className="hud-label">24h volume</div>{fmtUsd(sel.volume24hUsd)}</div>
              <div><div className="hud-label">Liquidity</div>{fmtUsd(sel.liquidityUsd)}</div>
              <div><div className="hud-label">Price</div>{sel.priceUsd ? `$${sel.priceUsd.toPrecision(3)}` : "—"}</div>
            </div>
          </div>
        )}
      </section>

      <div className="mx-auto grid max-w-3xl gap-3 px-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="hud-card p-3">
            <div className="hud-label">Faction volume routed · 24h</div>
            <div className="mt-1 text-xl font-black neon-text-amber">{data ? fmtUsd(data.factionVolumeUsd) : "—"}</div>
            <div className="text-[11px] text-muted-foreground">Whole TON market {data ? fmtUsd(data.marketVolumeUsd) : "—"}</div>
          </div>
          <div className="hud-card p-3">
            <div className="hud-label flex items-center gap-1"><Shield className="h-3 w-3" /> Trade shielding</div>
            <div className="mt-1 text-xl font-black text-neon-cyan">−{data?.radiation.shield ?? 0} rad</div>
            <div className="text-[11px] text-muted-foreground">Faction trading blocks up to 15 points</div>
          </div>
        </div>

        <div className="hud-card p-3">
          <div className="hud-title">Sector control</div>
          <ul className="mt-2 space-y-2">
            {sectors.map((s, i) => (
              <li key={s.id}>
                <button type="button" onClick={() => setSelected(s.id)} className="w-full text-left">
                  <div className="flex items-center justify-between text-sm">
                    <span className="flex items-center gap-2 font-black"><span className={cn("h-2.5 w-2.5 rounded-full", DOT[i])} />${s.symbol}</span>
                    <span className="font-mono text-xs text-muted-foreground">{s.volume24hUsd ? fmtUsd(s.volume24hUsd) : "no pool yet"}</span>
                  </div>
                  <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted">
                    <div className={cn("h-full", DOT[i])} style={{ width: `${Math.max(2, s.dominance * 100)}%` }} />
                  </div>
                </button>
              </li>
            ))}
            {!sectors.length && <li className="text-sm text-muted-foreground">{loading ? "Scanning sectors…" : "Market feed offline."}</li>}
          </ul>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="hud-card p-3">
            <div className="hud-title">Surviving factions</div>
            <ol className="mt-2 space-y-1 text-sm">
              {data?.timer.survivors.map((s) => (
                <li key={s.master} className="flex justify-between"><span>#{s.rank} ${s.symbol}</span><span className="font-mono text-xs text-muted-foreground">{Math.round(s.share * 100)}%</span></li>
              ))}
              {!data?.timer.survivors.length && <li className="text-muted-foreground">No ranked survivors yet.</li>}
            </ol>
          </div>
          <div className="hud-card p-3">
            <div className="hud-title">Top TonMap landlords</div>
            <ol className="mt-2 space-y-1 text-sm">
              {data?.vault.landlords.map((l, i) => (
                <li key={l.wallet + i} className="flex justify-between font-mono text-xs"><span>{l.wallet}</span><span>{l.pixels.toLocaleString()} px</span></li>
              ))}
              {!data?.vault.landlords.length && <li className="text-muted-foreground">No landlords on record yet.</li>}
            </ol>
          </div>
        </div>

        <div className="hud-card p-3">
          <div className="hud-title">Combat feed</div>
          <ul className="mt-2 space-y-1 text-xs">
            {data?.combat.map((c, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span className="truncate"><b className="text-neon-cyan">{c.attacker}</b> {c.hit ? "hit" : "missed"} <b>{c.victim}</b> · {c.weapon}</span>
                {c.glory > 0 && <span className="shrink-0 neon-text-amber">+{c.glory}</span>}
              </li>
            ))}
            {!data?.combat.length && <li className="text-muted-foreground">Radio silent. No strikes logged.</li>}
          </ul>
        </div>

        <div className="hud-card p-3">
          <div className="hud-title">War chest this week</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {data?.vault.pools.map((p) => (
              <span key={p.symbol} className="hud-chip text-neon-amber">{p.amount.toLocaleString(undefined, { maximumFractionDigits: 2 })} {p.symbol}</span>
            ))}
            {!data?.vault.pools.length && <span className="text-sm text-muted-foreground">Prize pools open once the vault is live.</span>}
          </div>
        </div>

        <button type="button" onClick={share} disabled={!data || sharing} className="cta-amber hit-cta flex min-h-12 w-full items-center justify-center gap-2 rounded-xl font-black disabled:opacity-40">
          <Share2 className="h-5 w-5" /> {sharing ? "Encrypting dossier…" : "Share battle intel"}
        </button>
        <Link to="/" className="text-center hud-label underline">Enter the game</Link>
      </div>

      <AgentConnectModal open={agentsOpen} onClose={() => setAgentsOpen(false)} />
    </main>
  );
}
