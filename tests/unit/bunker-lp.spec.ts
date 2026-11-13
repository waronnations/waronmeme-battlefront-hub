import { describe, expect, it } from "vitest";
import {
  BUNKER_LP_RULES,
  TON_ADDRESS,
  bunkerPool,
  checkLpMessages,
  coinLpMetrics,
  fmtBps,
  pledgeStatus,
  poolFromApi,
  positionFees,
  quoteProvide,
  type StonPoolRaw,
} from "@/lib/bunker/lp";
import { APOCALYPSE_AT } from "@/lib/war-cycle/cycle";

const COIN = "EQCoin000000000000000000000000000000000000000000";
const raw = (o: Partial<StonPoolRaw>): StonPoolRaw => ({
  address: "EQPool",
  router_address: "EQRouter",
  token0_address: COIN,
  token1_address: TON_ADDRESS,
  reserve0: "2000000000000",
  reserve1: "1000000000000",
  lp_total_supply: "500000000000",
  lp_total_supply_usd: "100000",
  lp_fee: "20",
  protocol_fee: "10",
  ref_fee: "10",
  lp_price_usd: "200",
  volume_24h_usd: "50000",
  apy_7d: "0.12",
  tags: ["pool:dex_major_version:2"],
  ...o,
});

describe("Bunker LP pool metrics", () => {
  it("reads which side of the pool is GRAM", () => {
    const p = poolFromApi(raw({}), COIN)!;
    expect(p.tonIsToken0).toBe(false);
    expect(p.reserveTon).toBe("1000000000000");
    expect(p.reserveCoin).toBe("2000000000000");
    expect(p.version).toBe(2);
  });

  it("splits a 0.30% fee into 0.20% for LPs and 0.10% protocol", () => {
    const m = coinLpMetrics([poolFromApi(raw({}), COIN)!]);
    expect(m.feeBps).toBe(30);
    expect(m.lpFeeShare).toBeCloseTo(2 / 3);
    expect(m.lpFees24hUsd).toBeCloseTo(100); // 50k × 0.20%
    expect(m.protocolFees24hUsd).toBeCloseTo(50);
    expect(m.feeApr).toBeCloseTo(0.365); // 100 × 365 / 100k
  });

  it("bunker share is pledged LP over the bunker pool's TVL and earns that share of LP fees", () => {
    const m = coinLpMetrics([poolFromApi(raw({}), COIN)!], { usd: 10_000, pledgers: 3 });
    expect(m.bunkerShare).toBeCloseTo(0.1);
    expect(m.bunkerFees24hUsd).toBeCloseTo(10);
    expect(m.bunkerPledgers).toBe(3);
  });

  it("only supplies v2 GRAM pools STON.fi recommends", () => {
    const v1 = poolFromApi(raw({ tags: ["pool:dex_major_version:1"], address: "v1" }), COIN)!;
    const off = poolFromApi(raw({ tags: ["pool:dex_major_version:2", "pool:liquidity_provision:not_recommended"], address: "off" }), COIN)!;
    expect(bunkerPool([v1, off])).toBeNull();
    const dust = poolFromApi(raw({ address: "dust", lp_total_supply_usd: "4999" }), COIN)!;
    expect(bunkerPool([dust])).toBeNull();
    const ok = poolFromApi(raw({ address: "ok" }), COIN)!;
    expect(bunkerPool([v1, off, ok])?.address).toBe("ok");
  });

  it("formats basis points as percentages", () => {
    expect(fmtBps(30)).toBe("0.3%");
    expect(fmtBps(7)).toBe("0.07%");
  });
});

describe("Bunker LP deposits", () => {
  const pool = poolFromApi(raw({}), COIN)!;

  it("matches the coin side to the pool ratio and floors LP by 5%", () => {
    const q = quoteProvide(pool, 1_000_000_000n); // 1 GRAM
    expect(q.coinUnits).toBe(2_000_000_000n);
    expect(q.expectedLp).toBe(500_000_000n);
    expect(q.minLpOut).toBe(475_000_000n);
  });

  it("position share and daily fees follow LP units", () => {
    const f = positionFees(50_000_000_000n, pool); // 10% of supply
    expect(f.share).toBeCloseTo(0.1);
    expect(f.feesPerDayUsd).toBeCloseTo(10);
    expect(f.valueUsd).toBeCloseTo(10_000);
  });

  it("refuses transactions that spend more than deposit + 0.8 GRAM gas", () => {
    const one = 1_000_000_000n;
    expect(() => checkLpMessages([{ address: "a", amount: "1500000000" }, { address: "b", amount: "300000001" }], one)).toThrow();
    expect(checkLpMessages([{ address: "a", amount: "1500000000" }, { address: "b", amount: "300000000" }], one)).toBe(1_800_000_000n);
    expect(() => checkLpMessages([{ address: "a", amount: "900000000" }], one)).toThrow();
  });
});

describe("Bunker LP pledges", () => {
  const base = { pledgedUnits: 100n, coinMaster: COIN, status: "holding" as const };
  it("holds until Doomsday while the wallet keeps the LP", () => {
    expect(BUNKER_LP_RULES.until).toBe(APOCALYPSE_AT);
    expect(pledgeStatus({ ...base, currentUnits: 100n, now: APOCALYPSE_AT - 1 })).toBe("holding");
  });
  it("breaks when LP is withdrawn before Doomsday, and stays broken", () => {
    expect(pledgeStatus({ ...base, currentUnits: 99n, now: APOCALYPSE_AT - 1 })).toBe("broken");
    expect(pledgeStatus({ ...base, status: "broken", currentUnits: 100n, now: APOCALYPSE_AT - 1 })).toBe("broken");
  });
  it("after Doomsday survives only in the apex coin", () => {
    expect(pledgeStatus({ ...base, currentUnits: null, now: APOCALYPSE_AT, apexMaster: COIN })).toBe("survived");
    expect(pledgeStatus({ ...base, currentUnits: null, now: APOCALYPSE_AT, apexMaster: "other" })).toBe("fallen");
  });
  it("needs at least $10 of LP", () => {
    expect(BUNKER_LP_RULES.minPledgeUsd).toBe(10);
  });
});
