import { describe, it, expect } from "vitest";
import {
  buildCourtesyEmailHtml,
  buildCourtesyEmailText,
} from "@/server/integrations/email/templates/courtesy-email";

const UNSUB   = "https://armani-katehano.com/unsubscribe?token=t";
const PRIVACY = "https://armani-katehano.com/privacy";

describe("courtesy-email template", () => {
  it("buildHtml contains the locked headline and both body paragraphs", () => {
    const html = buildCourtesyEmailHtml(UNSUB, PRIVACY);
    expect(html).toContain("As Armani Katehano keeps improving");
    expect(html).toContain("we've added a second kind of subscriber email");
    expect(html).toContain("Roster announcements before each game still arrive as before");
  });

  it("buildHtml uses the combined ARMANI KATEHANO + WHAT'S NEW eyebrow", () => {
    const html = buildCourtesyEmailHtml(UNSUB, PRIVACY);
    expect(html).toContain("ARMANI KATEHANO");
    expect(html).toContain("WHAT'S NEW");
  });

  it("buildHtml includes both footer links", () => {
    const html = buildCourtesyEmailHtml(UNSUB, PRIVACY);
    expect(html).toContain(UNSUB);
    expect(html).toContain(PRIVACY);
    expect(html).toContain("You subscribed to Armani Katehano game emails");
  });

  it("buildHtml escapes ampersands in the URLs", () => {
    const evilUrl = "https://example.com/?a=b&c=d";
    const html = buildCourtesyEmailHtml(evilUrl, PRIVACY);
    expect(html).toContain("a=b&amp;c=d");
    expect(html).not.toContain("a=b&c=d");
  });

  it("buildText contains the body paragraphs and both URLs", () => {
    const text = buildCourtesyEmailText(UNSUB, PRIVACY);
    expect(text).toContain("As Armani Katehano keeps improving");
    expect(text).toContain("we've added a second kind of subscriber email");
    expect(text).toContain("Roster announcements before each game still arrive as before");
    expect(text).toContain(UNSUB);
    expect(text).toContain(PRIVACY);
  });
});
