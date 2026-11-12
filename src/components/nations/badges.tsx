// src/components/nations/badges.tsx
import { Skull, Star } from "lucide-react";
import { cn } from "@/lib/utils";

export function TraitorBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "hud-chip text-destructive",
        className,
      )}
    >
      <Skull className="h-2.5 w-2.5" />
      Traitor
    </span>
  );
}

export function OfficerBadge() {
  return (
    <span className="hud-chip text-foreground">
      <Star className="h-2.5 w-2.5" />
      Officer
    </span>
  );
}
