import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { F, TextArea, Segmented, ArmedButton } from "@/client/admin/primitives";

describe("admin primitives", () => {
  it("Segmented is a labelled group of toggle buttons with the chosen one pressed", () => {
    const html = renderToStaticMarkup(createElement(Segmented<"a" | "b">, {
      label:    "Filter by status",
      options:  [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }],
      value:    "b",
      onChange: () => {},
    }));
    expect(html).toContain('role="group"');
    expect(html).toContain('aria-label="Filter by status"');
    expect(html).toMatch(/aria-pressed="false"[^>]*>Alpha</);
    expect(html).toMatch(/aria-pressed="true"[^>]*>Beta</);
    expect(html).toContain("min-h-[44px]");
    expect(html).toContain("focus-visible:outline-2");
  });

  it("TextArea is 16px, keeps its length limit and can switch to a monospace font", () => {
    const html = renderToStaticMarkup(createElement(TextArea, {
      label: "BODY", value: "", onChange: () => {}, maxLength: 200, mono: true,
    }));
    expect(html).toContain("<textarea");
    expect(html).toContain("text-base");
    expect(html).toMatch(/maxlength="200"/i);
    expect(html).toContain("font-mono");
    expect(html).not.toContain("font-sans");
  });

  it("F passes its length limit to the input", () => {
    const html = renderToStaticMarkup(createElement(F, { label: "SUBJECT", value: "", onChange: () => {}, maxLength: 200 }));
    expect(html).toMatch(/maxlength="200"/i);
  });

  it("ArmedButton starts unarmed and names its action", () => {
    const html = renderToStaticMarkup(createElement(ArmedButton, { label: "REMOVE", onConfirm: () => {} }));
    expect(html).toContain(">REMOVE<");
    expect(html).not.toContain("TAP AGAIN");
  });

  it("F passes a datalist id to the input", () => {
    const html = renderToStaticMarkup(createElement(F, { label: "NAME", value: "", onChange: () => {}, list: "opponent-names" }));
    expect(html).toContain('list="opponent-names"');
  });
});
