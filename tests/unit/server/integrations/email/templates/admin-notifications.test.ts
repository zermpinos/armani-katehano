import { describe, it, expect } from "vitest";
import { buildImportSuccess, buildImportStalled } from "@/server/integrations/email/templates/admin-notifications";

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

describe("buildImportStalled", () => {
  const entries = [{ sourceUrl: "https://example.com/men/game/1", reason: "player not on roster" }];

  it("lists each stuck game with its reason", () => {
    const { subject, html, text } = buildImportStalled({ entries });
    expect(subject).toContain("stuck on 1 game");
    expect(html).toContain("player not on roster");
    expect(text).toContain("https://example.com/men/game/1");
  });

  it("pluralises the subject on more than one game", () => {
    const { subject } = buildImportStalled({ entries: [...entries, { sourceUrl: "https://example.com/men/game/2", reason: "league unresolved" }] });
    expect(subject).toContain("stuck on 2 games");
  });

  it("reports a thrown run separately from stuck games", () => {
    const { subject, html, text } = buildImportStalled({ entries: [], error: "connection reset" });
    expect(subject).toContain("failed");
    expect(html).toContain("connection reset");
    expect(text).toContain("connection reset");
  });

  // Reasons carry upstream error text, so they reach the template untrusted.
  it("escapes markup in a reason", () => {
    const { html } = buildImportStalled({ entries: [{ sourceUrl: "https://example.com/x", reason: "<script>alert(1)</script>" }] });
    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
