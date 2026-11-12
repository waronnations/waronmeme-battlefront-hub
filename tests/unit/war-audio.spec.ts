import { describe, expect, it } from "vitest";
import { geigerRate } from "@/components/war-room/war-audio";

describe("Geiger counter", () => {
  it("ticks faster as radiation rises", () => {
    expect(geigerRate(0)).toBe(0.5);
    expect(geigerRate(100)).toBe(12);
    expect(geigerRate(80)).toBeGreaterThan(geigerRate(40));
  });
});
