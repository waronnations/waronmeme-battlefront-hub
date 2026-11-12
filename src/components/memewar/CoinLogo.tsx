// src/components/memewar/CoinLogo.tsx
import { CachedTokenImage } from "@/components/ui/CachedTokenImage";

/** Jetton logo with fallback chain: proxied preview → raw metadata → initials badge (cached). */
export function CoinLogo({
  image,
  imageRaw,
  symbol,
  className,
}: {
  image: string | null;
  imageRaw?: string | null;
  symbol: string;
  className?: string;
}) {
  return <CachedTokenImage src={image} sources={[imageRaw]} symbol={symbol} className={className} />;
}

export function fmtAmount(n: number): string {
  if (!Number.isFinite(n)) return "—";
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  if (n >= 1) return n.toFixed(2);
  return n.toPrecision(3);
}

export function fmtUsd(n: number): string {
  if (!(n > 0)) return "$—";
  if (n >= 1000) return `$${fmtAmount(n)}`;
  if (n >= 1) return `$${n.toFixed(2)}`;
  return `$${n.toPrecision(2)}`;
}
