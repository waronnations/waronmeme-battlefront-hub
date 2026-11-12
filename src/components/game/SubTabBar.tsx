// src/components/game/SubTabBar.tsx
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { ActionButton } from "@/components/ActionButton";

export function SubTabBar<T extends string>({
  tabs,
  value,
  onChange,
}: {
  tabs: {
    id: T;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }[];
  value: T;
  onChange: (id: T) => void;
}) {
  return (
    <div role="group" aria-label="Section navigation" className="hud-segment mb-4">
      {tabs.map((t) => {
        const Icon = t.icon;
        const active = value === t.id;
        return (
          <ActionButton
            key={t.id}
            type="button"
            onClick={() => {
              onChange(t.id);
              haptic("light");
            }}
            aria-pressed={active}
            className={cn("min-h-12 min-w-0 flex-1 flex-col gap-1 rounded-[0.7rem] border-0 bg-transparent px-1 text-[10px] font-black uppercase tracking-wider", active ? "hud-segment-active" : "text-muted-foreground")}
          >
            <Icon className="h-4 w-4" />
            <span>{t.label}</span>
          </ActionButton>
        );
      })}
    </div>
  );
}
