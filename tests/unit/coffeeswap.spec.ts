import { describe, expect, it } from "vitest";
import {
  routeFor,
  simulateQuote,
  swapAssets,
  toTonConnectRequest,
  validateSlippage,
} from "@/lib/dex/coffeeswap";

const assets = swapAssets();
const by = (k: string) => assets.find((a) => a.key === k)!;
const market = {
  ton: { priceUsd: 2, liquidityUsd: 0 },
  warcat: { priceUsd: 0.5, liquidityUsd: 1_000_000 },
  wardog: { priceUsd: 0.01, liquidityUsd: 200_000 },
};

describe("CoffeeSwap quotes", () => {
  it("the native coin is shown as GRAM", () => {
    expect(by("ton").symbol).toBe("GRAM");
    expect(assets.some((a) => a.symbol === "TON")).toBe(false);
  });

  it("GRAM → WARDOG is one hop; WARCAT → WARDOG routes through GRAM", () => {
    expect(routeFor(by("ton"), by("wardog"), assets).map((a) => a.symbol)).toEqual(["GRAM", "WARDOG"]);
    expect(routeFor(by("warcat"), by("wardog"), assets).map((a) => a.symbol)).toEqual(["WARCAT", "GRAM", "WARDOG"]);
  });

  it("applies the 0.3% fee and constant-product impact", () => {
    const q = simulateQuote({ amountIn: 10, from: by("ton"), to: by("wardog"), assets, market, slippageBps: 100 });
    if (!q.ok) throw new Error(q.reason);
    // $20 in, $19.94 after fee, reserve $100K: out = 100000*19.94/(100000+19.94)
    const outUsd = (100_000 * 19.94) / (100_000 + 19.94);
    expect(q.amountOut).toBeCloseTo(outUsd / 0.01, 6);
    expect(q.feeUsd).toBeCloseTo(0.06, 9);
    expect(q.minOut).toBeCloseTo(q.amountOut * 0.99, 6);
    expect(q.hops).toHaveLength(1);
  });

  it("flags price impact above 5%", () => {
    const q = simulateQuote({ amountIn: 5_000, from: by("ton"), to: by("wardog"), assets, market, slippageBps: 100 });
    expect(q.ok && q.highImpact).toBe(true);
  });

  it("refuses to quote pools with no liquidity or unlinked tokens", () => {
    const dry = simulateQuote({ amountIn: 1, from: by("ton"), to: by("warcat"), assets, market: { ...market, warcat: { priceUsd: 1, liquidityUsd: 0 } }, slippageBps: 100 });
    expect(dry).toEqual({ ok: false, reason: "No GRAM/WARCAT pool with liquidity yet" });
    const unlinked = { ...by("warcat"), address: null };
    const q = simulateQuote({ amountIn: 1, from: by("ton"), to: unlinked, assets, market, slippageBps: 100 });
    expect(q).toEqual({ ok: false, reason: "$WARCAT isn't linked yet" });
  });

  it("slippage must be between 0.1% and 20%", () => {
    expect(validateSlippage(9)).not.toBeNull();
    expect(validateSlippage(10)).toBeNull();
    expect(validateSlippage(2000)).toBeNull();
    expect(validateSlippage(2001)).not.toBeNull();
  });

  it("maps CoffeeSwap transactions to a TonConnect request valid for 5 minutes", () => {
    const r = toTonConnectRequest([{ address: "EQrouter", value: "1050000000", cell: "te6cc" }], 1_000_000);
    expect(r).toEqual({ validUntil: 1_300, messages: [{ address: "EQrouter", amount: "1050000000", payload: "te6cc" }] });
    expect(() => toTonConnectRequest([])).toThrow();
    expect(() => toTonConnectRequest(Array(5).fill({ address: "a", value: "1", cell: "" }))).toThrow();
  });
});
