// In-memory + localStorage LRU cache with per-entry TTL for market metrics,
// prices and token-image status. Browser-safe: storage is touched lazily and
// every storage call is guarded, so SSR and blocked storage fall back to memory.

type Entry = { v: unknown; exp: number; at: number; p: boolean };

export type MetricCacheOptions = {
  /** Max entries kept in memory; least recently used are evicted first. */
  maxEntries?: number;
  /** localStorage key; null disables persistence. */
  storageKey?: string | null;
  /** Persisted entries older than this are dropped on load (default 24h). */
  maxStaleMs?: number;
  /** Max serialized size written to storage (default 300 KB). */
  maxBytes?: number;
  now?: () => number;
  storage?: () => Storage | null;
};

export type Peek<T> = { value: T; fresh: boolean; age: number };

function defaultStorage(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

export class MetricCache {
  private map = new Map<string, Entry>();
  private inflight = new Map<string, Promise<unknown>>();
  private hydrated = false;
  private writeTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly max: number;
  private readonly key: string | null;
  private readonly maxStale: number;
  private readonly maxBytes: number;
  private readonly now: () => number;
  private readonly storage: () => Storage | null;

  constructor(opts: MetricCacheOptions = {}) {
    this.max = Math.max(1, opts.maxEntries ?? 200);
    this.key = opts.storageKey === undefined ? "won:metric-cache:v1" : opts.storageKey;
    this.maxStale = opts.maxStaleMs ?? 24 * 3_600_000;
    this.maxBytes = opts.maxBytes ?? 300_000;
    this.now = opts.now ?? Date.now;
    this.storage = opts.storage ?? defaultStorage;
  }

  private hydrate() {
    if (this.hydrated) return;
    this.hydrated = true;
    if (!this.key) return;
    const s = this.storage();
    if (!s) return;
    try {
      const raw = s.getItem(this.key);
      if (!raw) return;
      const rows = JSON.parse(raw) as [string, Entry][];
      const t = this.now();
      for (const [k, e] of rows) {
        if (!e || typeof e.exp !== "number" || t - e.at > this.maxStale) continue;
        if (!this.map.has(k)) this.map.set(k, { ...e, p: true });
      }
      this.evict();
    } catch {
      /* corrupt or blocked storage — start empty */
    }
  }

  private evict() {
    while (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      if (oldest === undefined) break;
      this.map.delete(oldest);
    }
  }

  private touch(k: string, e: Entry) {
    this.map.delete(k);
    this.map.set(k, e);
  }

  private schedulePersist() {
    if (!this.key || this.writeTimer) return;
    this.writeTimer = setTimeout(() => {
      this.writeTimer = null;
      this.flush();
    }, 250);
  }

  /** Write persisted entries to storage now (most recent kept if over budget). */
  flush() {
    if (this.writeTimer) {
      clearTimeout(this.writeTimer);
      this.writeTimer = null;
    }
    if (!this.key) return;
    const s = this.storage();
    if (!s) return;
    let rows = [...this.map.entries()].filter(([, e]) => e.p);
    let json = JSON.stringify(rows);
    while (json.length > this.maxBytes && rows.length > 0) {
      rows = rows.slice(Math.ceil(rows.length / 4));
      json = JSON.stringify(rows);
    }
    try {
      s.setItem(this.key, json);
    } catch {
      try {
        s.setItem(this.key, JSON.stringify(rows.slice(Math.ceil(rows.length / 2))));
      } catch {
        /* quota full — memory only */
      }
    }
  }

  /** Fresh value or undefined. */
  get<T>(key: string): T | undefined {
    const p = this.peek<T>(key);
    return p && p.fresh ? p.value : undefined;
  }

  /** Value even when stale, so screens can paint instantly while refreshing. */
  peek<T>(key: string): Peek<T> | undefined {
    this.hydrate();
    const e = this.map.get(key);
    if (!e) return undefined;
    this.touch(key, e);
    const t = this.now();
    return { value: e.v as T, fresh: t < e.exp, age: t - e.at };
  }

  set<T>(key: string, value: T, ttlMs: number, opts: { persist?: boolean } = {}) {
    this.hydrate();
    const t = this.now();
    const e: Entry = { v: value, exp: t + Math.max(0, ttlMs), at: t, p: opts.persist ?? true };
    this.touch(key, e);
    this.evict();
    if (e.p) this.schedulePersist();
  }

  delete(key: string) {
    this.hydrate();
    if (this.map.delete(key)) this.schedulePersist();
  }

  clear() {
    this.map.clear();
    this.inflight.clear();
    this.hydrated = true;
    const s = this.key ? this.storage() : null;
    try {
      if (s && this.key) s.removeItem(this.key);
    } catch {
      /* ignore */
    }
  }

  get size() {
    this.hydrate();
    return this.map.size;
  }

  /**
   * Fresh cached value, else run `loader` once (parallel callers share the
   * same request) and cache the result. Failed loads are not cached.
   */
  async fetch<T>(key: string, ttlMs: number, loader: () => Promise<T>, opts: { force?: boolean; persist?: boolean } = {}): Promise<T> {
    if (!opts.force) {
      const hit = this.get<T>(key);
      if (hit !== undefined) return hit;
    }
    const running = this.inflight.get(key);
    if (running) return running as Promise<T>;
    const p = loader()
      .then((v) => {
        this.set(key, v, ttlMs, { persist: opts.persist });
        return v;
      })
      .finally(() => this.inflight.delete(key));
    this.inflight.set(key, p);
    return p;
  }
}

/** Shared app-wide cache. */
export const metricCache = new MetricCache();

export const TTL = {
  board: 5 * 60_000,
  prices: 2 * 60_000,
  routes: 20_000,
  apocalypse: 10 * 60_000,
  imageOk: 7 * 24 * 3_600_000,
  imageBad: 6 * 3_600_000,
} as const;

// ── Token image status ────────────────────────────────────────────────
export type ImageStatus = "ok" | "bad" | "unknown";

export function imageStatus(url: string, cache: MetricCache = metricCache): ImageStatus {
  const v = cache.get<ImageStatus>(`img:${url}`);
  return v === "ok" || v === "bad" ? v : "unknown";
}

export function markImage(url: string, status: "ok" | "bad", cache: MetricCache = metricCache) {
  cache.set(`img:${url}`, status, status === "ok" ? TTL.imageOk : TTL.imageBad);
}

/** Warm the browser image cache so tab switches paint logos immediately. */
export function preloadTokenImages(urls: (string | null | undefined)[], cache: MetricCache = metricCache) {
  if (typeof window === "undefined" || typeof Image === "undefined") return;
  for (const url of urls) {
    if (!url || imageStatus(url, cache) !== "unknown") continue;
    const img = new Image();
    img.decoding = "async";
    img.onload = () => markImage(url, "ok", cache);
    img.onerror = () => markImage(url, "bad", cache);
    img.src = url;
  }
}
