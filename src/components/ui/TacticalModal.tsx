// Shared "incoming transmission" HUD dialog: scanlines, sweeping border,
// corner brackets, a transmission badge, and sound + haptic on open.
import { useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Radio, X, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptic, hapticNotify } from "@/lib/telegram";
import { playAlarm, playClaim, playError, playRankUp, playTransmission } from "@/lib/sounds";

export type TacticalTone = "cyan" | "amber" | "green" | "danger";
export type TacticalSound = "transmission" | "victory" | "reward" | "alert" | "error" | "none";
export type TacticalHaptic = "light" | "medium" | "heavy" | "success" | "warning" | "error" | "none";

const SOUNDS: Record<Exclude<TacticalSound, "none">, () => void> = {
  transmission: playTransmission,
  victory: playRankUp,
  reward: playClaim,
  alert: playAlarm,
  error: playError,
};

/** Fire a feedback cue; never throws (audio can be blocked until a tap). */
const LAYER_Z = { base: "z-50", top: "z-[110]", max: "z-[120]", lock: "z-[200]" } as const;

export function tacticalFeedback(sound: TacticalSound, buzz: TacticalHaptic) {
  try {
    if (sound !== "none") SOUNDS[sound]();
  } catch {
    /* audio blocked */
  }
  if (buzz === "success" || buzz === "warning" || buzz === "error") hapticNotify(buzz);
  else if (buzz !== "none") haptic(buzz);
}

export function TacticalModal({
  open,
  onClose,
  title,
  subtitle,
  badge = "Incoming transmission",
  badgeIcon: BadgeIcon = Radio,
  tone = "cyan",
  icon,
  sound = "transmission",
  hapticOnOpen = "medium",
  layer = "base",
  align = "bottom",
  closeOnBackdrop = true,
  className,
  footer,
  children,
}: {
  open: boolean;
  /** Omit to force a choice (no close button, backdrop and Escape ignored). */
  onClose?: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  badge?: string;
  badgeIcon?: LucideIcon;
  tone?: TacticalTone;
  /** Optional hero emblem shown above the title. */
  icon?: ReactNode;
  sound?: TacticalSound;
  hapticOnOpen?: TacticalHaptic;
  /** Stacking: base z-50, top z-110, max z-120, lock z-200 (blocking lock screens). */
  layer?: "base" | "top" | "max" | "lock";
  align?: "bottom" | "center";
  closeOnBackdrop?: boolean;
  className?: string;
  footer?: ReactNode;
  children?: ReactNode;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  // Portal to <body> so animated (transformed) parents can't trap the overlay under the top bar.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open || !mounted) return;
    tacticalFeedback(sound, hapticOnOpen);
    panelRef.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeRef.current) closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // Feedback should fire once per opening, not when cue props change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mounted]);

  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className={cn(
            "fixed inset-0 flex justify-center bg-background/90 p-3 backdrop-blur-md",
            align === "center" ? "items-center" : "items-end sm:items-center",
            LAYER_Z[layer],
          )}
          style={{ paddingTop: "max(0.75rem, env(safe-area-inset-top))", paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
          // Portal events still bubble through React parents; keep taps from reaching the board behind.
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => {
            e.stopPropagation();
            if (closeOnBackdrop) onClose?.();
          }}
        >
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            initial={{ y: 40, opacity: 0, scale: 0.97 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              `tac-tone-${tone}`,
              "holo-panel holo-scan tac-frame relative max-h-[92dvh] w-full max-w-md overflow-y-auto p-4 outline-none",
              className,
            )}
          >
            <span aria-hidden className="tac-corner tac-corner-tl" />
            <span aria-hidden className="tac-corner tac-corner-tr" />
            <span aria-hidden className="tac-corner tac-corner-bl" />
            <span aria-hidden className="tac-corner tac-corner-br" />

            {onClose && (
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="absolute right-3 top-3 z-10 grid h-11 w-11 place-items-center rounded-full border border-border bg-background/60 text-muted-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}

            <div className={cn("relative", icon && "text-center")}>
              <span className="tac-badge">
                <span aria-hidden className="tac-blink" />
                <BadgeIcon className="h-3 w-3" /> {badge}
              </span>
              {icon && <div className="mx-auto mt-3 grid h-16 w-16 place-items-center rounded-full border border-current tac-text">{icon}</div>}
              <h2 id={titleId} className="tac-text mt-2 pr-10 text-xl font-black uppercase leading-tight tracking-tight">
                {title}
              </h2>
              {subtitle && <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>}
            </div>

            <div className="relative">{children}</div>
            {footer && <div className="relative mt-4 space-y-2">{footer}</div>}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function TacticalSection({ label, className, children }: { label?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cn("mt-3 rounded-xl border border-border bg-secondary/60 p-3", className)}>
      {label && <div className="text-[10px] font-black uppercase tracking-[0.14em] text-muted-foreground">{label}</div>}
      {children}
    </section>
  );
}

const CTA_VARIANTS = {
  deploy: "cta-deploy",
  amber: "cta-amber",
  danger: "cta-danger",
  ghost: "border border-border bg-transparent text-foreground",
} as const;

/** High-contrast full-width call to action with a tap buzz. */
export function TacticalCTA({
  variant = "deploy",
  buzz = "heavy",
  className,
  onClick,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: keyof typeof CTA_VARIANTS; buzz?: TacticalHaptic }) {
  return (
    <button
      type={type}
      onClick={(e) => {
        tacticalFeedback("none", buzz);
        onClick?.(e);
      }}
      className={cn(
        "hit-cta flex w-full items-center justify-center gap-2 px-4 transition-transform active:scale-[0.98] disabled:pointer-events-none disabled:opacity-40",
        CTA_VARIANTS[variant],
        className,
      )}
      {...props}
    />
  );
}

/** Two-line choice button: bold label plus a small reward/detail line. */
export function TacticalChoice({
  label,
  detail,
  className,
  ...props
}: Omit<Parameters<typeof TacticalCTA>[0], "children"> & { label: ReactNode; detail?: ReactNode }) {
  return (
    <TacticalCTA className={cn("flex-col gap-0.5 py-3", className)} {...props}>
      <span className="text-sm">{label}</span>
      {detail && <span className="text-[11px] font-bold normal-case tracking-normal opacity-85">{detail}</span>}
    </TacticalCTA>
  );
}
