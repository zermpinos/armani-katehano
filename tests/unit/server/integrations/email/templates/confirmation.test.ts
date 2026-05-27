import { describe, it, expect } from "vitest";
import {
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
} from "@/server/integrations/email/templates/confirmation";

const CONFIRM_URL = "https://armani-katehano.com/api/confirm?token=abc123";
const APP_URL     = "https://armani-katehano.com";

describe("buildConfirmationEmailHtml", () => {
  it("contains the preheader text", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain("Confirm your email to receive Armani Katehano game emails.");
  });

  it("contains MSO conditional comments", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain("<!--[if mso]><table width=\"100%\"><tr><td><![endif]-->");
    expect(html).toContain("<!--[if mso]></td></tr></table><![endif]-->");
  });

  it("uses lang=en", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain('lang="en"');
    expect(html).not.toContain('lang="el"');
  });

  it("includes the logo image", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain(`${APP_URL}/logohighres.png`);
  });

  it("uses bgcolor and background-color on the dark header cell", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain('bgcolor="#111111"');
    expect(html).toContain("background-color:#111111");
  });

  it("contains the confirm URL as the CTA href", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain(CONFIRM_URL);
  });

  it("contains the corrected link-expiry copy", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain("This link is valid for 24 hours.");
    expect(html).not.toContain("Link expires after use");
  });

  it("contains a privacy notice link", () => {
    const html = buildConfirmationEmailHtml(CONFIRM_URL, APP_URL);
    expect(html).toContain(`${APP_URL}/privacy`);
    expect(html).toContain("Privacy notice");
  });

  it("escapes HTML-significant characters in the confirm URL", () => {
    const evilUrl = "https://example.com/confirm?token=a&b=c";
    const html    = buildConfirmationEmailHtml(evilUrl, APP_URL);
    expect(html).toContain("a&amp;b=c");
    expect(html).not.toContain("a&b=c");
  });
});

describe("buildConfirmationEmailText", () => {
  it("contains the confirm URL", () => {
    const text = buildConfirmationEmailText(CONFIRM_URL, APP_URL);
    expect(text).toContain(CONFIRM_URL);
  });

  it("contains the corrected link-expiry copy", () => {
    const text = buildConfirmationEmailText(CONFIRM_URL, APP_URL);
    expect(text).toContain("This link is valid for 24 hours.");
    expect(text).not.toContain("Link expires after use");
  });

  it("contains the privacy notice URL", () => {
    const text = buildConfirmationEmailText(CONFIRM_URL, APP_URL);
    expect(text).toContain(`${APP_URL}/privacy`);
  });
});
