import { describe, it, expect } from "vitest";
import { buildImportSuccess } from "@/server/integrations/email/templates/admin-notifications";

const base = {
  opponent:     "Olympiacos B",
  location:     "home",
  scheduledFor: "2026-05-15T19:00:00Z",
  importedAt:   new Date("2026-05-16T08:00:00Z"),
};

describe("buildImportSuccess", () => {
  it("omits the broadcast section when broadcastLink is not provided", () => {
    const { html, text } = buildImportSuccess(base);
    expect(html).not.toContain("Broadcast to subscribers");
    expect(text).not.toContain("Broadcast to subscribers");
  });

  it("renders the broadcast block when broadcastLink is provided", () => {
    const link = "https://armani-katehano.com/api/admin/import-jobs/broadcast?token=abc.def";
    const { html, text } = buildImportSuccess({ ...base, broadcastLink: link });
    expect(html).toContain(link);
    expect(html).toContain("Broadcast to subscribers");
    expect(text).toContain(link);
    expect(text).toContain("Broadcast to subscribers");
  });

  it("escapes the broadcast link URL in the HTML href", () => {
    const link = "https://example.com/x?token=a&b=c";
    const { html } = buildImportSuccess({ ...base, broadcastLink: link });
    expect(html).toContain("a&amp;b=c");
  });
});
