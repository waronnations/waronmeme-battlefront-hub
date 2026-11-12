// src/components/game/TabHero.tsx
import { Radio } from "lucide-react";
import type { PrimaryTab } from "@/components/game/PrimaryTabBar";

export const TAB_HERO: Record<PrimaryTab | "ops" | "battlefield", { title: string; desc: string }> = {
  season: { title: "Season", desc: "Confirmed coin battles and commander rankings." },
  play: {
    title: "Memecoin War",
    desc: "Merge your real TON memecoins · live DeDust + STON.fi routes · crown one champion.",
  },
  battlefield: {
    title: "Battlefield",
    desc: "Pick a weapon, take aim and strike rival players for glory.",
  },
  ops: {
    title: "Daily operations",
    desc: "Finish the 3 daily ops, then tap CLAIM — rewards only pay when claimed.",
  },
  world: {
    title: "Nations",
    desc: "Join or lead a nation, or launch Strategic Nukes against other countries.",
  },
  earn: {
    title: "Rewards",
    desc: "Shop uses topped-up tokens · Claim unclaimed merge earnings · Recruit allies.",
  },
  base: {
    title: "Profile",
    desc: "Commander profile, equipment and forged items.",
  },
};

const TAB_SECTOR: Record<PrimaryTab | "ops" | "battlefield", string> = {
  season: "Sector 02 · Rankings",
  play: "Sector 01 · Front line",
  battlefield: "Sector 01 · Live fire",
  ops: "Sector 01 · Operations",
  world: "Sector 03 · Geopolitics",
  earn: "Sector 04 · Supply depot",
  base: "Sector 05 · Command post",
};

export function TabHero({ tab }: { tab: PrimaryTab | "ops" | "battlefield" }) {
  const h = TAB_HERO[tab];
  return (
    <header className="tac-tone-cyan mb-4 pt-1">
      <span className="tac-badge">
        <span aria-hidden className="tac-blink" />
        <Radio className="h-3 w-3" /> {TAB_SECTOR[tab]}
      </span>
      <h1 className="tac-text mt-2 text-2xl font-black uppercase leading-none tracking-tight">{h.title}</h1>
      <p className="mt-1.5 text-xs leading-snug text-muted-foreground">{h.desc}</p>
    </header>
  );
}
