import { describe, it, expect } from "vitest";
import { createElement, Fragment } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { BottomSheet, SheetError } from "@/client/admin/bottom-sheet";

const sheet = (title: string) => {
  const props = { open: false, title, onClose: () => {}, footer: null, children: null };
  return createElement(BottomSheet, props);
};

describe("BottomSheet", () => {
  it("gives every mounted sheet its own title id", () => {
    const html = renderToStaticMarkup(createElement(Fragment, null, sheet("One"), sheet("Two")));
    const ids = [...html.matchAll(/aria-labelledby="([^"]+)"/g)].map(m => m[1]);
    expect(ids).toHaveLength(2);
    expect(new Set(ids).size).toBe(2);
    for (const id of ids) expect(html).toContain(`id="${id}"`);
  });

  it("shows an error as an alert", () => {
    expect(renderToStaticMarkup(createElement(SheetError, null, "Nope"))).toMatch(/role="alert"[^>]*>Nope</);
  });
});
