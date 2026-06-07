import { describe, it, expect } from "vitest";
import { buildImportSuccess, buildImportFailure } from "@/server/integrations/email/templates/admin-notifications";

const base = {
  opponent:     "Olympiacos B",
  location:     "home",
  scheduledFor: "2026-05-15T19:00:00Z",
  importedAt:   new Date("2026-05-16T08:00:00Z"),
};

describe("buildImportSuccess", () => {
  it("renders the match, scheduled date, and imported-at timestamp", () => {
    const { subject, html, text } = buildImportSuccess(base);
    expect(subject).toContain("Olympiacos B");
    expect(html).toContain("vs Olympiacos B");
    expect(text).toContain("vs Olympiacos B");
    expect(text).toContain(base.importedAt.toISOString());
  });
});

describe("buildImportFailure", () => {
  it("includes attempt count and last error", () => {
    const { subject, html, text } = buildImportFailure({
      ...base,
      attempts:  2,
      lastError: "timeout fetching upstream",
    });
    expect(subject).toContain("Import failed");
    expect(html).toContain("timeout fetching upstream");
    expect(text).toContain("Attempts: 2");
  });
});
