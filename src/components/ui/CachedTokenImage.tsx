import { useEffect, useMemo, useState } from "react";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";
import { imageStatus, markImage } from "@/lib/cache/metric-cache";

const AVATAR_TONES = [
  "border-neon-cyan/50 text-neon-cyan",
  "border-neon-green/50 text-neon-green",
  "border-neon-amber/50 text-neon-amber",
  "border-destructive/50 text-destructive",
] as const;

function toneFor(symbol: string) {
  let h = 0;
  for (let i = 0; i < symbol.length; i++) h = (h * 31 + symbol.charCodeAt(i)) >>> 0;
  return AVATAR_TONES[h % AVATAR_TONES.length];
}

/**
 * Token logo backed by the metric cache: known-good images paint without a
 * skeleton, known-broken URLs are skipped instantly, and an initials avatar is
 * the final fallback.
 */
export function CachedTokenImage({
  src,
  sources,
  symbol,
  className,
  alt,
}: {
  src?: string | null;
  sources?: (string | null | undefined)[];
  symbol: string;
  className?: string;
  alt?: string;
}) {
  const sig = [src, ...(sources ?? [])].map((s) => s ?? "").join("\n");
  const list = useMemo(() => sig.split("\n").filter((s, i, a) => Boolean(s) && a.indexOf(s) === i), [sig]);
  // Start with the first candidate so server and client render the same markup.
  const [idx, setIdx] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    // Skip URLs the cache already knows are broken.
    let i = 0;
    while (i < list.length && imageStatus(list[i]!) === "bad") i++;
    setIdx(i);
    setLoaded(i < list.length && imageStatus(list[i]!) === "ok");
  }, [list]);

  const url = list[idx];
  if (!url) {
    const initials = symbol.replace(/^\$/, "").slice(0, 3).toUpperCase();
    return (
      <div
        role="img"
        aria-label={alt ?? `${symbol} logo`}
        className={cn("flex shrink-0 items-center justify-center rounded-full border bg-secondary font-black", toneFor(symbol), className)}
      >
        {initials ? <span className="text-[0.7em] leading-none">{initials}</span> : <Coins className="h-1/2 w-1/2" />}
      </div>
    );
  }

  return (
    <span className={cn("relative inline-block shrink-0 overflow-hidden rounded-full bg-muted", className)}>
      {!loaded && <span aria-hidden className="skeleton-shimmer absolute inset-0 rounded-full" />}
      <img
        key={url}
        src={url}
        alt={alt ?? `${symbol} logo`}
        loading="lazy"
        decoding="async"
        draggable={false}
        onLoad={() => {
          markImage(url, "ok");
          setLoaded(true);
        }}
        onError={() => {
          markImage(url, "bad");
          setLoaded(false);
          setIdx((i) => i + 1);
        }}
        className={cn("h-full w-full rounded-full object-cover transition-opacity duration-200", loaded ? "opacity-100" : "opacity-0")}
      />
    </span>
  );
}
