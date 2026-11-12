import { describe, it, expect } from "vitest";
import { ANTAGONIST_TRANSMISSION } from "./lore";
describe("antagonist transmission", () => {
  it("opens and closes with the agreed lines", () => {
    expect(ANTAGONIST_TRANSMISSION[0]).toBe("Let me tell you straight what you’re up against.");
    expect(ANTAGONIST_TRANSMISSION.at(-1)).toBe("This is the reality.");
  });
});
