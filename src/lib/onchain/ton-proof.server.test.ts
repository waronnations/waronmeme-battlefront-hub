// @vitest-environment node
import { describe, it, expect } from "vitest";
import { issueProofPayload, checkProofPayload } from "./ton-proof.server";

describe("proof payloads", () => {
  it("accepts a fresh payload this server issued", () => {
    expect(checkProofPayload(issueProofPayload(1000), 1001)).toBeNull();
  });
  it("rejects a tampered payload", () => {
    const p = issueProofPayload(1000);
    const t = p.slice(0, 10) + (p[10] === "a" ? "b" : "a") + p.slice(11);
    expect(checkProofPayload(t, 1001)).toBe("proof_payload_invalid");
  });
  it("rejects a payload after its 15 minute window", () => {
    expect(checkProofPayload(issueProofPayload(1000), 1000 + 15 * 60 + 1)).toBe("proof_payload_expired");
  });
});
