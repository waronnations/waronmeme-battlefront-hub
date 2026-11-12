// src/components/nations/detail/HistoryList.tsx
import { ScrollText } from "lucide-react";
import { formatEvent, formatTime } from "./history-events";
import type { NationHistoryRow } from "../use-nations-panel";

export function HistoryList({
  history = [],
  historyLoading = false,
}: {
  history?: NationHistoryRow[];
  historyLoading?: boolean;
}) {
  return (
    <div className="holo-panel p-4 mt-4">
      <div className="hud-title mb-2 flex items-center gap-1.5">
        <ScrollText className="h-3.5 w-3.5 text-neon-cyan" />
        History
      </div>
      {historyLoading ? (
        <div className="hud-card p-3 text-center text-xs text-muted-foreground">
          Loading history...
        </div>
      ) : history.length === 0 ? (
        <div className="hud-card p-3 text-center text-xs text-muted-foreground">
          No events yet
        </div>
      ) : (
        <div className="max-h-40 space-y-1.5 overflow-y-auto">
          {history.map((h) => (
            <div
              key={h.id}
              className="hud-card p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-semibold text-foreground">
                  {formatEvent(h.event)}
                </span>
                <span className="shrink-0 text-[0.6rem] text-muted-foreground">
                  {formatTime(h.createdAt)}
                </span>
              </div>
              {h.userName && (
                <div className="mt-0.5 text-[0.65rem] text-muted-foreground">
                  {h.userName}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
