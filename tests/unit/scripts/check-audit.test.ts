import { describe, it, expect } from "vitest";
import { evaluate } from "../../../scripts/ci/check-audit.mjs";

const BRACES = "GHSA-vfj7-8cjw-p6xm";
const TODAY  = "2026-10-15";

const report = {
  vulnerabilities: {
    braces:     { via: [{ name: "braces", url: `https://github.com/advisories/${BRACES}` }] },
    micromatch: { via: ["braces"] },
  },
};
const accepted = { [BRACES]: { package: "braces", reason: "dev-only", review_by: "2026-12-01" } };

describe("check-audit evaluate", () => {
  it("accepts a listed advisory before its review date", () => {
    const r = evaluate(report, accepted, TODAY);
    expect(r.accepted).toEqual([`${BRACES} (braces, review_by 2026-12-01)`]);
    expect([...r.unlisted, ...r.expired, ...r.invalid, ...r.stale]).toEqual([]);
  });

  it("fails an advisory that is not listed", () => {
    expect(evaluate(report, {}, TODAY).unlisted).toEqual([`${BRACES} (braces)`]);
  });

  it("fails a listed advisory once its review date has passed", () => {
    const r = evaluate(report, accepted, "2026-12-02");
    expect(r.expired).toHaveLength(1);
    expect(r.accepted).toEqual([]);
  });

  it("rejects an exception without a reason, or with a review date beyond 90 days", () => {
    expect(evaluate(report, { [BRACES]: { review_by: "2026-12-01" } }, TODAY).invalid).toEqual([BRACES]);
    expect(evaluate(report, { [BRACES]: { reason: "x", review_by: "2027-06-01" } }, TODAY).invalid).toEqual([BRACES]);
    expect(evaluate(report, { [BRACES]: { reason: "x" } }, TODAY).invalid).toEqual([BRACES]);
  });

  it("flags an exception that no longer matches any advisory", () => {
    expect(evaluate({ vulnerabilities: {} }, accepted, TODAY).stale).toEqual([BRACES]);
  });

  it("fails closed when npm audit returns an error instead of a report", () => {
    expect(() => evaluate({ error: { code: "ENOTFOUND" } }, accepted, TODAY)).toThrow(/no report/);
  });
});
