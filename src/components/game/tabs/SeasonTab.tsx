import { TabHero } from "@/components/game/TabHero";
import { LeaderboardPanel } from "@/components/Panels";
import type { GameState } from "@/lib/game-state";
import type { useLeaderboard } from "@/hooks/use-server-progress";

export function SeasonTab({ state, leaderboard, myUserId, authenticated }: {
  state: GameState;
  leaderboard: ReturnType<typeof useLeaderboard>["entries"];
  myUserId: number | null;
  authenticated: boolean;
}) {
  return (
    <div className="space-y-4">
      <TabHero tab="season" />
      <LeaderboardPanel state={state} serverEntries={leaderboard} myUserId={myUserId} authenticated={authenticated} />
    </div>
  );
}