// src/components/TopupButton.tsx
import { useState } from "react";
import { ArrowDownToLine } from "lucide-react";
import { haptic } from "@/lib/telegram";
import { cn } from "@/lib/utils";
import { TopupModal } from "@/components/TopupModal";

export function TopupButton({ className }: { className?: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setOpen(true);
          haptic("light");
        }}
        className={cn(
          "cta-amber inline-flex min-h-11 items-center gap-1.5 rounded-xl px-3 py-1.5 text-[0.65rem] font-black uppercase tracking-wider transition",
          className,
        )}
      >
        <ArrowDownToLine className="h-3.5 w-3.5" />
        Top up
      </button>
      <TopupModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
