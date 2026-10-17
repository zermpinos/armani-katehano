import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { isConfirmed, mergeRows, emptyMessage, type SubscriberRow } from "@/client/admin/subscribers/subscriber-list";
import { SubscriberSheet } from "@/client/admin/subscribers/SubscriberSheet";

const row = (id: string, confirmedAt: string | null = "2026-09-01T10:05:00.000Z"): SubscriberRow =>
  ({ id, email: `${id}@example.com`, createdAt: "2026-09-01T10:00:00.000Z", confirmedAt });

describe("subscriber list helpers", () => {
  it("mergeRows appends only rows it has not seen, in order", () => {
    const merged = mergeRows([row("a"), row("b")], [row("b"), row("c"), row("d")]);
    expect(merged.map(r => r.id)).toEqual(["a", "b", "c", "d"]);
  });

  it("isConfirmed reads confirmedAt", () => {
    expect(isConfirmed(row("a"))).toBe(true);
    expect(isConfirmed(row("b", null))).toBe(false);
  });

  it("emptyMessage follows the search first, then the filter", () => {
    expect(emptyMessage("unconfirmed", "zz").title).toBe("No matches");
    expect(emptyMessage("unconfirmed", "").title).toBe("No pending sign-ups");
    expect(emptyMessage("confirmed", "").title).toBe("No confirmed subscribers");
    expect(emptyMessage("all", "").title).toBe("No subscribers yet");
  });
});

describe("SubscriberSheet", () => {
  it("shows a pending subscriber's details and an unarmed Remove", () => {
    const html = renderToStaticMarkup(createElement(SubscriberSheet, {
      open: true, row: row("fan", null), error: null, onRemove: () => {}, onClose: () => {},
    }));
    expect(html).toContain("fan@example.com");
    expect(html).toContain("Pending");
    expect(html).toContain("Not yet");
    expect(html).toContain(">REMOVE<");
  });
});
