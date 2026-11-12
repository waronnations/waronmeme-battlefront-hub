// src/components/claim/ClaimAmountControls.tsx
import { TOKENS } from "@/lib/tokens";
import { cn } from "@/lib/utils";
import type { TokenKey } from "@/components/claim/claim-helpers";

export function ClaimAmountControls({
  token,
  available,
  minAmount,
  value,
  onChange,
  disabled,
}: {
  token: TokenKey;
  available: number;
  minAmount: number;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const setPct = (pct: number) => {
    const n = Math.floor(available * pct * 100) / 100;
    onChange(n > 0 ? String(n) : "");
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <label className="hud-label">
          Amount to claim
        </label>
        <button
          type="button"
          disabled={disabled || available < minAmount}
          onClick={() => setPct(1)}
          className="min-h-11 text-[0.65rem] font-bold uppercase tracking-wider text-foreground hover:text-foreground disabled:opacity-40"
        >
          Max {available.toFixed(2)}
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="number"
          inputMode="decimal"
          min={minAmount}
          max={available}
          step="0.01"
          placeholder={`Min ${minAmount}`}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full hud-card p-3 text-sm font-semibold text-foreground outline-none placeholder:text-muted-foreground focus:border-neon-cyan/40 disabled:opacity-50"
        />
      </div>

      <div className="flex flex-wrap gap-1.5">
        {[0.25, 0.5, 0.75, 1].map((pct) => (
          <button
            key={pct}
            type="button"
            disabled={disabled || available < minAmount}
            onClick={() => setPct(pct)}
            className={cn(
              "min-h-11 hud-input px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-foreground transition hover:border-border hover:text-foreground disabled:opacity-40",
            )}
          >
            {pct === 1 ? "Max" : `${pct * 100}%`}
          </button>
        ))}
      </div>

      <p className="text-[0.6rem] text-muted-foreground">
        <span
          className={
            token === "wardog" ? "text-destructive" : "text-neon-cyan"
          }
        >
          {TOKENS[token].symbol}
        </span>
        : available {available.toFixed(2)} · min {minAmount}
      </p>
    </div>
  );
}
