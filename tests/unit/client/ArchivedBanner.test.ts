import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ArchivedBanner from "@/components/ui/ArchivedBanner";

const render = (archived: boolean, seasonName: string) =>
  renderToStaticMarkup(createElement(ArchivedBanner, { archived, seasonName }));

describe("ArchivedBanner", () => {
  it("renders when archived is true", () => {
    const html = render(true, "2025-26");
    expect(html).toMatch(/2025-26 Season Complete/i);
    expect(html).toContain('role="status"');
  });

  it("renders nothing when archived is false", () => {
    expect(render(false, "2025-26")).toBe("");
  });

  it("renders nothing for the all-time view", () => {
    expect(render(true, "all-time")).toBe("");
  });
});
