import { fmtBps } from "@/lib/bunker/lp";

export { fmtBps };
export const fmtUsdShort = (n: number) =>
  !(n > 0) ? "$0" : n >= 1e6 ? `$${(n / 1e6).toFixed(2)}M` : n >= 1e3 ? `$${(n / 1e3).toFixed(1)}K` : n >= 1 ? `$${n.toFixed(2)}` : `$${n.toFixed(4)}`;
export const fmtPct = (x: number, digits = 1) => `${(x * 100).toFixed(digits)}%`;
export const fmtShare = (x: number) => (x <= 0 ? "0%" : x < 0.0001 ? "<0.01%" : `${(x * 100).toFixed(x < 0.01 ? 3 : 2)}%`);
