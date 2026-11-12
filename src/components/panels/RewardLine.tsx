// src/components/panels/RewardLine.tsx
// Faction-colored HUD reward readout
export function RewardLine({
  glory,
  wardog,
  warcat,
  energy,
}: {
  glory?: number;
  wardog?: number;
  warcat?: number;
  energy?: number;
}) {
  const parts: { key: string; text: string; className: string }[] = [];

  if (glory && glory > 0) {
    parts.push({
      key: "glory",
      text: `+${glory} glory`,
      className: "neon-text-amber",
    });
  }
  if (wardog && wardog > 0) {
    parts.push({
      key: "wardog",
      text: `+${wardog} $WARDOG`,
      className: "text-destructive",
    });
  }
  if (warcat && warcat > 0) {
    parts.push({
      key: "warcat",
      text: `+${warcat} $WARCAT`,
      className: "text-neon-cyan",
    });
  }
  if (energy && energy > 0) {
    parts.push({
      key: "energy",
      text: `+${energy} energy`,
      className: "neon-text-amber",
    });
  }

  if (!parts.length) return null;

  return (
    <div className="mt-0.5 flex flex-wrap gap-x-2 gap-y-0.5 text-[0.65rem] font-mono font-black">
      {parts.map((p) => (
        <span key={p.key} className={p.className}>
          {p.text}
        </span>
      ))}
    </div>
  );
}
