// src/components/game/tabs/PlayTab.tsx
// The Play tab is the Memecoin War board plus the Bunker liquidity front.
import { MemeWarBoard } from "@/components/memewar/MemeWarBoard";
import { BunkerLpBoard } from "@/components/bunker/BunkerLpBoard";

export function PlayTab() {
  return (
    <div className="space-y-4">
      <MemeWarBoard embedded />
      <div className="mx-auto w-full max-w-lg">
        <BunkerLpBoard />
      </div>
    </div>
  );
}
