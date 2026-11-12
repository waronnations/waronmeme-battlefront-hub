import { describe, expect, it } from "vitest";
import {
  CURVE_FEE_BPS,
  checkSwapTxs,
  curveQuote,
  graduationOf,
  minReceived,
  pickBest,
  safetyOf,
  summarizeCoffeeRoute,
  swapOutcome,
  tradesInGame,
  type CoffeePath,
  type RouteQuote,
} from "@/lib/dex/routes";

const tok = (symbol: string, verification: string) => ({ metadata: { symbol, verification } });
const hop = (dex: string, a: [string, string], b: [string, string], next?: CoffeePath[]): CoffeePath => ({
  dex,
  input_token: tok(...a),
  output_token: tok(...b),
  next,
});
const GRAM: [string, string] = ["GRAM", "whitelisted"];
const DOG: [string, string] = ["WARDOG", "community"];

describe("jetton safety", () => {
  it("only verified and safe-contract jettons are routable", () => {
    expect(safetyOf("WHITELISTED").routable).toBe(true);
    expect(safetyOf("community").routable).toBe(true);
    expect(safetyOf("UNKNOWN").routable).toBe(false);
    expect(safetyOf("BLACKLISTED").routable).toBe(false);
    expect(safetyOf(undefined).level).toBe("UNKNOWN");
  });
});

describe("swap.coffee route summaries", () => {
  it("reads output, absolute impact, gas, hops and DEX names", () => {
    const q = summarizeCoffeeRoute("best", {
      output_amount: 2_720_000,
      price_impact: -0.088,
      recommended_gas: 0.619,
      paths: [hop("stonfi_v2", GRAM, ["STON", "whitelisted"], [hop("stonfi_v2", ["STON", "whitelisted"], DOG)])],
    });
    if (!q.ok) throw new Error(q.reason);
    expect(q.amountOut).toBe(2_720_000);
    expect(q.priceImpact).toBeCloseTo(0.088, 9);
    expect(q.gasGram).toBe(0.619);
    expect(q.hops.map((h) => `${h.from}>${h.to}`)).toEqual(["GRAM>STON", "STON>WARDOG"]);
    expect(q.dexes).toEqual(["STON.fi"]);
  });

  it("refuses routes through unverified or blacklisted tokens", () => {
    const q = summarizeCoffeeRoute("best", {
      output_amount: 10,
      price_impact: -0.01,
      paths: [hop("dedust", GRAM, ["SCAM", "unknown"], [hop("dedust", ["SCAM", "unknown"], DOG)])],
    });
    expect(q).toEqual({ venue: "best", ok: false, reason: "Route passes through unverified $SCAM" });
  });

  it("treats empty and partially filled routes as unavailable", () => {
    expect(summarizeCoffeeRoute("tonco", { output_amount: 0, price_impact: "NaN", paths: [] }).ok).toBe(false);
    const partial = summarizeCoffeeRoute("dedust", { output_amount: 5, left_amount: 1, paths: [hop("dedust", GRAM, DOG)] });
    expect(partial).toEqual({ venue: "dedust", ok: false, reason: "Not enough liquidity for the full amount" });
  });

  it("a direct DEX route may not borrow another exchange's pools", () => {
    const mixed = { output_amount: 9, price_impact: -0.4, paths: [hop("dedust", GRAM, ["STON", "whitelisted"], [hop("stonfi_v2", ["STON", "whitelisted"], DOG)])] };
    expect(summarizeCoffeeRoute("dedust", mixed, ["dedust", "dedust_v2"])).toEqual({ venue: "dedust", ok: false, reason: "No route on DeDust pools alone" });
    expect(summarizeCoffeeRoute("best", mixed).ok).toBe(true);
  });

  it("minimum received applies slippage to the routed output", () => {
    expect(minReceived(1000, 100)).toBe(990);
  });
});

describe("memepad graduation", () => {
  it("a jetton with x1000 Uranus wallet code that trades on DEX has graduated", () => {
    expect(graduationOf({ type: "common", contract_interface: "jetton_wallet_uranus" })).toEqual({ status: "graduated", protocol: "URANUS", pad: "x1000 Uranus" });
    expect(graduationOf({ type: "common", contract_interface: "jetton_wallet_v1" })).toEqual({ status: "dex" });
  });

  it("a memepad jetton reports curve progress toward its GRAM target", () => {
    const g = graduationOf({ type: "memepad", protocol: "URANUS", market_stats: { progress: 0.42, collected_ton: 651, max_ton: 1550 } });
    expect(g).toEqual({ status: "curve", protocol: "URANUS", pad: "x1000 Uranus", progress: 0.42, collected: 651, target: 1550 });
  });

  it("curve quotes deduct the 1% launch fee and are closed after graduation", () => {
    expect(CURVE_FEE_BPS).toBe(100);
    const curve = graduationOf({ type: "memepad", protocol: "URANUS", market_stats: { progress: 0.1 } });
    const q = curveQuote({ amountIn: 10, gramUsd: 2, tokenUsd: 0.001, graduation: curve, toSymbol: "WARDOG" });
    if (!q.ok) throw new Error(q.reason);
    expect(q.amountOut).toBeCloseTo((9.9 * 2) / 0.001, 6);
    expect(q.estimate).toBe(true);
    const done = curveQuote({ amountIn: 10, gramUsd: 2, tokenUsd: 0.001, graduation: { status: "graduated", protocol: "URANUS", pad: "x1000 Uranus" }, toSymbol: "WARDOG" });
    expect(done.ok === false && done.graduated).toBe(true);
  });
});

describe("best route", () => {
  const ok = (venue: RouteQuote["venue"], amountOut: number, estimate = false): RouteQuote => ({
    venue, ok: true, amountOut, priceImpact: 0, gasGram: 0, hops: [], dexes: [], splits: 1, estimate,
  });
  it("picks the highest routed output and ignores curve estimates when a pool route exists", () => {
    expect(pickBest([ok("best", 100), ok("dedust", 60), ok("x1000", 500, true)])).toBe("best");
    expect(pickBest([{ venue: "best", ok: false, reason: "x" }, ok("x1000", 5, true)])).toBe("x1000");
    expect(pickBest([{ venue: "best", ok: false, reason: "x" }])).toBeNull();
  });
});

describe("in-game swap execution", () => {
  const tx = (value: string) => ({ address: "0:abc", value, cell: "te6cc" });
  it("accepts the amount plus recommended gas", () => {
    // 1 GRAM swap + 0.619 GRAM gas, exactly what swap.coffee builds for a STON.fi route
    const r = checkSwapTxs([tx("1619000000")], 1, 0.619);
    expect(r.messages[0]).toEqual({ address: "0:abc", amount: "1619000000", payload: "te6cc" });
  });
  it("refuses a transaction that spends more than amount + gas + 0.5 GRAM", () => {
    expect(() => checkSwapTxs([tx("2120000000")], 1, 0.619)).toThrow(/more than your amount/);
    expect(() => checkSwapTxs([tx("1000000000"), tx("1200000000")], 1, 0.619)).toThrow();
  });
  it("caps extra gas at 3 GRAM even if the route recommends more", () => {
    expect(() => checkSwapTxs([tx("13100000000")], 10, 9)).toThrow();
    expect(checkSwapTxs([tx("13000000000")], 10, 9).messages).toHaveLength(1);
  });
  it("refuses a transaction that doesn't carry the full amount", () => {
    expect(() => checkSwapTxs([tx("900000000")], 1, 0.6)).toThrow(/full amount/);
  });
  it("memepad curves are quote-only; DEX routes trade in-game", () => {
    expect(tradesInGame("x1000")).toBe(false);
    expect(tradesInGame("best")).toBe(true);
    expect(tradesInGame("stonfi")).toBe(true);
  });
  it("reads swap.coffee results", () => {
    expect(swapOutcome({ terminal: false, splits: [{ status: "pending" }] })).toBe("pending");
    expect(swapOutcome(null)).toBe("pending");
    expect(swapOutcome({ terminal: true, splits: [{ status: "succeeded" }, { status: "succeeded" }] })).toBe("success");
    expect(swapOutcome({ terminal: true, splits: [{ status: "succeeded" }, { status: "failed" }] })).toBe("partial");
    expect(swapOutcome({ terminal: true, splits: [{ status: "failed" }] })).toBe("failed");
  });
});
