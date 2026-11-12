// src/components/claim/ClaimHistoryList.tsx
import { Clock } from "lucide-react";
import { TOKENS } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import { statusClass, statusLabel } from "@/components/claim/claim-helpers";
import type { ClaimsSnapshot } from "@/lib/claims.functions";

export function ClaimHistoryList({
  snapshot,
  onRefund,
}: {
  snapshot: ClaimsSnapshot | null;
  onRefund?: (claimId: number) => void;
}) {
  return (
    <div className="holo-panel p-4">
      <div className="mb-3 flex items-center gap-2">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span className="text-[0.65rem] font-black uppercase tracking-widest text-muted-foreground">
          Recent claims
        </span>
      </div>
      {(snapshot?.claims?.length ?? 0) === 0 ? (
        <p className="text-xs text-muted-foreground">No claims yet.</p>
      ) : (
        <ul className="space-y-2">
          {snapshot!.claims.slice(0, 8).map((c) => (
            <li
              key={c.id}
              className="flex items-center justify-between gap-2 hud-card p-3"
            >
              <div>
                <div className="text-xs font-mono font-black text-foreground">
                  {c.amount.toFixed(2)}{" "}
                  <span
                    className={
                      c.token === "wardog" ? "text-destructive" : "text-neon-cyan"
                    }
                  >
                    {TOKENS[c.token].symbol}
                  </span>
                </div>
                <div className="text-[0.6rem] text-muted-foreground">
                  {new Date(c.createdAt).toLocaleString()}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {c.status === "pending" && onRefund ? (
                  <button
                    type="button"
                    onClick={() => onRefund(c.id)}
                    className="min-h-11 rounded-md px-2 py-0.5 text-[0.55rem] font-bold uppercase tracking-wider text-neon-amber hover:bg-neon-amber/40"
                  >
                    Restore
                  </button>
                ) : null}
                <span
                  className={cn(
                    "hud-chip",
                    statusClass(c.status),
                  )}
                >
                  {statusLabel(c.status)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
