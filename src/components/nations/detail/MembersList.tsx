// src/components/nations/detail/MembersList.tsx
import { Crown, UserMinus, Users, Ban } from "lucide-react";
import { TraitorBadge, OfficerBadge } from "../badges";
import type { NationDetails } from "../use-nations-panel";

export function MembersList({
  selected,
  isLeader,
  promoting,
  demoting,
  handlePromote,
  handleDemote,
  kicking = null,
  handleKick,
}: {
  selected: NationDetails;
  isLeader: boolean;
  promoting: number | null;
  demoting: number | null;
  handlePromote: (toUserId: number) => Promise<void>;
  handleDemote: (toUserId: number) => Promise<void>;
  kicking?: number | null;
  handleKick?: (targetUserId: number) => Promise<void>;
}) {
  if (!(selected.topMembers?.length > 0)) return null;
  return (
    <div className="holo-panel p-4 mt-4">
      <div className="hud-title mb-2 flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-neon-cyan" />
        Members
      </div>
      <div className="space-y-1.5">
        {selected.topMembers.map((m) => (
          <div
            key={m.userId}
            className="flex items-center justify-between hud-card p-3"
          >
            <div className="flex items-center gap-2 min-w-0">
              <span className="truncate text-sm font-medium text-foreground">
                {m.username
                  ? `@${m.username}`
                  : m.firstName || `#${m.userId}`}
              </span>
              {m.role === "leader" && (
                <Crown className="h-3 w-3 shrink-0 text-neon-amber" />
              )}
              {m.role === "officer" && <OfficerBadge />}
              {m.isTraitor && <TraitorBadge />}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="shrink-0 text-xs font-mono font-black neon-text-cyan">
                {m.glory.toLocaleString()}
              </span>
              {isLeader && m.role === "member" && (
                <button
                  onClick={() => handlePromote(m.userId)}
                  disabled={promoting === m.userId}
                  className="min-h-11 min-w-11 rounded bg-neon-cyan/60 border border-neon-cyan/40 px-1.5 py-0.5 text-[0.6rem] font-bold text-neon-cyan disabled:opacity-50"
                >
                  {promoting === m.userId ? "..." : "Promote"}
                </button>
              )}
              {isLeader && m.role === "officer" && (
                <button
                  onClick={() => handleDemote(m.userId)}
                  disabled={demoting === m.userId}
                  className="min-h-11 min-w-11 rounded bg-transparent border border-border px-1.5 py-0.5 text-[0.6rem] font-bold text-muted-foreground disabled:opacity-50"
                >
                  {demoting === m.userId ? (
                    "..."
                  ) : (
                    <UserMinus className="h-3 w-3" />
                  )}
                </button>
              )}
              {isLeader &&
                m.role === "member" &&
                handleKick && (
                  <button
                    onClick={() => void handleKick(m.userId)}
                    disabled={kicking === m.userId}
                    title="Kick member"
                    className="min-h-11 min-w-11 rounded bg-destructive/60 border border-destructive/40 px-1.5 py-0.5 text-[0.6rem] font-bold text-destructive disabled:opacity-50"
                  >
                    {kicking === m.userId ? (
                      "..."
                    ) : (
                      <Ban className="h-3 w-3" />
                    )}
                  </button>
                )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
