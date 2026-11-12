import { describe, expect, it, vi } from "vitest";
import { MetricCache, imageStatus, markImage } from "@/lib/cache/metric-cache";

function memStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

describe("MetricCache", () => {
  it("expires entries after their TTL but keeps them readable as stale", () => {
    let t = 1_000;
    const c = new MetricCache({ storageKey: null, now: () => t });
    c.set("price", 42, 60_000);
    expect(c.get("price")).toBe(42);
    t += 60_001;
    expect(c.get("price")).toBeUndefined();
    expect(c.peek("price")).toMatchObject({ value: 42, fresh: false });
  });

  it("evicts the least recently used entry when full", () => {
    const c = new MetricCache({ storageKey: null, maxEntries: 2 });
    c.set("a", 1, 10_000);
    c.set("b", 2, 10_000);
    c.get("a"); // a is now most recent
    c.set("c", 3, 10_000);
    expect(c.peek("b")).toBeUndefined();
    expect(c.get("a")).toBe(1);
    expect(c.get("c")).toBe(3);
  });

  it("persists to storage and restores in a new session", () => {
    const storage = memStorage();
    const a = new MetricCache({ storageKey: "k", storage: () => storage });
    a.set("board", { top: "DOGS" }, 60_000);
    a.set("secret-ish", 1, 60_000, { persist: false });
    a.flush();
    const b = new MetricCache({ storageKey: "k", storage: () => storage });
    expect(b.get("board")).toEqual({ top: "DOGS" });
    expect(b.peek("secret-ish")).toBeUndefined();
  });

  it("drops persisted entries older than maxStaleMs on load", () => {
    const storage = memStorage();
    let t = 0;
    const a = new MetricCache({ storageKey: "k", storage: () => storage, now: () => t });
    a.set("old", 1, 1_000);
    a.flush();
    t = 25 * 3_600_000;
    const b = new MetricCache({ storageKey: "k", storage: () => storage, now: () => t });
    expect(b.peek("old")).toBeUndefined();
  });

  it("shares one request between parallel fetches and does not cache failures", async () => {
    const c = new MetricCache({ storageKey: null });
    const loader = vi.fn(async () => 7);
    const [x, y] = await Promise.all([c.fetch("k", 1_000, loader), c.fetch("k", 1_000, loader)]);
    expect([x, y]).toEqual([7, 7]);
    expect(loader).toHaveBeenCalledTimes(1);

    await expect(c.fetch("bad", 1_000, async () => { throw new Error("down"); })).rejects.toThrow("down");
    expect(c.peek("bad")).toBeUndefined();
  });

  it("remembers broken and good token images", () => {
    const c = new MetricCache({ storageKey: null });
    expect(imageStatus("https://x/a.png", c)).toBe("unknown");
    markImage("https://x/a.png", "bad", c);
    markImage("https://x/b.png", "ok", c);
    expect(imageStatus("https://x/a.png", c)).toBe("bad");
    expect(imageStatus("https://x/b.png", c)).toBe("ok");
  });
});
