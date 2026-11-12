// src/components/nations/detail/ActionFooter.tsx
import { Shield, ShoppingCart, Users } from "lucide-react";
import type { NationDetails, PayToken } from "../use-nations-panel";

export function ActionFooter({
  selected,
  handleJoin,
  joiningId,
  handleBuy,
  buying,
}: {
  selected: NationDetails;
  handleJoin: (nationId: number) => void;
  joiningId: number | null;
  handleBuy: (nationId: number, payWith: PayToken) => Promise<void>;
  buying: boolean;
}) {
  return (
    <div className="mt-5 space-y-2">
      {selected.canClaim && (
        <button
          onClick={() => handleJoin(selected.id)}
          disabled={joiningId === selected.id}
          className="min-h-11 min-w-11 flex w-full items-center justify-center gap-2 hit-cta cta-deploy py-3 text-sm disabled:opacity-50"
        >
          <Shield className="h-4 w-4" />
          {joiningId === selected.id
            ? "Claiming..."
            : "Claim as Leader"}
        </button>
      )}

      {!selected.isMember &&
        !selected.isDefault &&
        selected.memberCount > 0 &&
        !selected.canBuy && (
          <button
            onClick={() => handleJoin(selected.id)}
            disabled={joiningId === selected.id}
            className="min-h-11 min-w-11 flex w-full items-center justify-center gap-2 rounded-xl border border-border bg-transparent py-3 text-sm font-bold text-foreground hover:border-border disabled:opacity-50"
          >
            <Users className="h-4 w-4" />
            {joiningId === selected.id
              ? "Joining..."
              : selected.isProtected
                ? "Join (contribution required)"
                : "Join Nation"}
          </button>
        )}

      {/* Buy with chosen token — never TON */}
      {selected.canBuy && selected.listedPrice && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
            <ShoppingCart className="h-3.5 w-3.5" />
            Buy for {selected.listedPrice} of one token
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() =>
                void handleBuy(selected.id, "wardog")
              }
              disabled={buying}
              className="min-h-11 min-w-11 hit-cta cta-amber py-3 text-[0.7rem] disabled:opacity-50"
            >
              {buying ? "..." : `$WARDOG · ${selected.listedPrice}`}
            </button>
            <button
              type="button"
              onClick={() =>
                void handleBuy(selected.id, "warcat")
              }
              disabled={buying}
              className="min-h-11 min-w-11 hit-cta cta-amber py-3 text-[0.7rem] disabled:opacity-50"
            >
              {buying ? "..." : `$WARCAT · ${selected.listedPrice}`}
            </button>
          </div>
        </div>
      )}

      {selected.isMember && (
        <div className="hud-card p-3 border-neon-amber/30 text-center text-sm font-bold text-neon-amber">
          You are a member of this nation
        </div>
      )}
    </div>
  );
}
