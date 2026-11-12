import { useEffect, useRef } from "react";
import { bindBackButton, guardClosing } from "@/lib/telegram";

/** Shows Telegram's back button while `onBack` is non-null. */
export function useTelegramBackButton(onBack: (() => void) | null) {
  const ref = useRef(onBack);
  ref.current = onBack;
  const active = onBack != null;
  useEffect(() => {
    if (!active) return bindBackButton(null);
    const handler = () => ref.current?.();
    return bindBackButton(handler);
  }, [active]);
}

/** Asks for confirmation before Telegram closes the app while `active`. */
export function useClosingGuard(active: boolean) {
  useEffect(() => {
    if (!active) return;
    guardClosing(true);
    return () => guardClosing(false);
  }, [active]);
}
