import { describe, it, expect } from "vitest";
import { renderMarkdown, buildBroadcastHtml, buildBroadcastText } from "@/server/integrations/email/templates/broadcast";

describe("renderMarkdown", () => {
  it("returns a string for simple markdown", () => {
    const result = renderMarkdown("Hello **world**");
    expect(typeof result).toBe("string");
    expect(result).toContain("<strong>world</strong>");
  });
  it("escapes raw HTML - script tag is not executed", () => {
    const result = renderMarkdown("<script>alert(1)</script>");
    expect(result).not.toContain("<script>");
    expect(result).toContain("&lt;script&gt;");
  });
  it("escapes raw HTML - img onerror is neutralised", () => {
    const result = renderMarkdown('<img onerror="fetch(\'x\')" src="x">');
    expect(result).not.toContain("<img");
    expect(result).toContain("&lt;img");
  });
  it("renders links correctly", () => {
    const result = renderMarkdown("[click here](https://example.com)");
    expect(result).toContain('href="https://example.com"');
    expect(result).toContain("click here");
  });
});

describe("buildBroadcastHtml", () => {
  const html = renderMarkdown("Hello **world**");
  const output = buildBroadcastHtml(html, "https://example.com", "https://example.com/unsubscribe?token=abc");
  it("contains the rendered body content", () => {
    expect(output).toContain("<strong>world</strong>");
  });
  it("contains the unsubscribe link", () => {
    expect(output).toContain("https://example.com/unsubscribe?token=abc");
    expect(output).toContain("Unsubscribe");
  });
  it("does NOT echo the subject in the body", () => {
    expect(output).not.toContain("<title>subject</title>");
  });
  it("is a valid HTML document", () => {
    expect(output).toContain("<!DOCTYPE html");
    expect(output).toContain("</html>");
  });
  it("contains the appUrl in the footer", () => {
    expect(output).toContain("https://example.com");
  });
});

describe("buildBroadcastText", () => {
  const html = renderMarkdown("Hello [click](https://example.com/page)");
  const output = buildBroadcastText(html, "https://example.com", "https://example.com/unsubscribe?token=abc");
  it("converts links to text (url) format", () => {
    expect(output).toContain("click (https://example.com/page)");
  });
  it("strips HTML tags from body", () => {
    expect(output).not.toContain("<");
    expect(output).not.toContain(">");
  });
  it("includes the unsubscribe URL in plain text", () => {
    expect(output).toContain("To unsubscribe: https://example.com/unsubscribe?token=abc");
  });
  it("includes the app URL", () => {
    expect(output).toContain("https://example.com");
  });
});
