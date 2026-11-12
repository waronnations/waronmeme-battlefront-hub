import { useCallback, useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { metricCache, TTL } from "./metric-cache";
import { getTierBoardFn, getApocalypseFn } from "@/lib/war-cycle.functions";

/**
 * Reads `key` from the shared metric cache (stale values paint instantly),
 * then refreshes in the background when the entry is missing or expired.
 */
export function useCachedQuery<T>(key: string | null, ttlMs: number, loader: () => Promise<T>, opts: { refreshMs?: number } = {}) {
  const loaderRef = useRef(loader);
  loaderRef.current = loader;
  const [data, setData] = useState<T | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (force: boolean) => {
      if (!key) return;
      try {
        const v = await metricCache.fetch(key, ttlMs, () => loaderRef.current(), { force });
        setData(v);
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unavailable");
      } finally {
        setLoading(false);
      }
    },
    [key, ttlMs],
  );

  useEffect(() => {
    if (!key) return;
    const hit = metricCache.peek<T>(key);
    if (hit) {
      setData(hit.value);
      setLoading(false);
    }
    if (!hit || !hit.fresh) void run(false);
    if (!opts.refreshMs) return;
    const t = setInterval(() => void run(true), opts.refreshMs);
    return () => clearInterval(t);
  }, [key, run, opts.refreshMs]);

  return { data, loading: loading && data === undefined, error, refresh: () => run(true) };
}

/** Public tiered memecoin board, shared by briefing, radar and Apocalypse. */
export function useTierBoard() {
  const get = useServerFn(getTierBoardFn);
  return useCachedQuery("board:tiers", TTL.board, () => get());
}

/** Conviction-weighted Apocalypse standings (needs the game database). */
export function useApocalypseStandings() {
  const get = useServerFn(getApocalypseFn);
  return useCachedQuery("apocalypse:standings", TTL.apocalypse, () => get());
}
