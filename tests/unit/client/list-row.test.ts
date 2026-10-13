import { describe, it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ListRow } from "@/client/admin/list-row";

describe("ListRow", () => {
  it("stays focusable while its save is pending, so a closing sheet can hand focus back", () => {
    const html = renderToStaticMarkup(ListRow({ onClick: () => {}, pending: true, children: "Row" }));
    expect(html).toContain('aria-disabled="true"');
    expect(html).not.toMatch(/\sdisabled=""/);
  });
});
