import { useEffect, useState } from "react";

/** Thin top banner shown while the device has no connection (common in Telegram on mobile). */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  if (!offline) return null;
  return (
    <div
      role="status"
      className="fixed inset-x-0 top-0 z-[100] bg-destructive px-4 py-2 text-center text-sm font-medium text-destructive-foreground"
      style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.5rem)" }}
    >
      You're offline. Progress will sync when the connection is back.
    </div>
  );
}
