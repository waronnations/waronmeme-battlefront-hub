// src/components/nations/detail/BuffsSection.tsx
import { RefreshCw, Zap, Shield, Swords } from "lucide-react";
import { NATION_BUFFS, type NationBuffId } from "@/lib/constants";

export function BuffsSection({
  canManageBuffs,
  activatingBuff,
  activateBuff,
}: {
  canManageBuffs: boolean;
  activatingBuff: string | null;
  activateBuff: (buffId: NationBuffId) => Promise<void>;
}) {
  if (!canManageBuffs) return null;

  const buffs: {
    id: NationBuffId;
    icon: React.ReactNode;
    border: string;
    bg: string;
    titleColor: string;
  }[] = [
    {
      id: "gloryBoost",
      icon: <Zap className="h-4 w-4 text-neon-amber" />,
      border: "border-neon-amber/30",
      bg: "bg-neon-amber/20",
      titleColor: "text-neon-amber",
    },
    {
      id: "energySurge",
      icon: <Zap className="h-4 w-4 text-neon-cyan" />,
      border: "border-neon-cyan/30",
      bg: "bg-neon-cyan/20",
      titleColor: "text-neon-cyan",
    },
    {
      id: "mergeFrenzy",
      icon: <Swords className="h-4 w-4 text-neon-amber" />,
      border: "border-neon-amber/30",
      bg: "bg-neon-amber/20",
      titleColor: "text-neon-amber",
    },
    {
      id: "shieldWall",
      icon: <Shield className="h-4 w-4 text-neon-green" />,
      border: "border-neon-green/30",
      bg: "bg-neon-green/20",
      titleColor: "text-neon-green",
    },
  ];

  return (
    <div className="holo-panel p-4 mt-3 space-y-2">
      <div className="hud-title text-neon-amber">
        Activate Buff (from Vault)
      </div>

      {buffs.map((b) => {
        const def = NATION_BUFFS[b.id];
        const isActive = activatingBuff === b.id;
        return (
          <button
            key={b.id}
            onClick={() => activateBuff(b.id)}
            disabled={!!activatingBuff}
            className={`min-h-11 flex w-full items-center justify-between hud-card p-3 ${b.border} ${b.bg} text-left text-sm disabled:opacity-50`}
          >
            <div>
              <div className={`font-bold ${b.titleColor}`}>{def.name}</div>
              <div className="text-xs text-muted-foreground">
                {def.desc} · {def.costWardog} + {def.costWarcat} from vault
              </div>
            </div>
            {isActive ? (
              <RefreshCw className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              b.icon
            )}
          </button>
        );
      })}
    </div>
  );
}
