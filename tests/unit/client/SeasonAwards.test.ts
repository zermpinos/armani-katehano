import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SeasonAwards from "@/components/ui/SeasonAwards";
import type { Awards, PlayerRef } from "@/domain/awards";

const ref = (name: string, value: number): PlayerRef => ({
  playerId: name.toLowerCase(),
  playerName: name,
  playerSlug: name.toLowerCase(),
  playerNumber: 1,
  value,
});

const render = (awards: Awards | null) =>
  renderToStaticMarkup(createElement(SeasonAwards, { awards }));

describe("SeasonAwards", () => {
  it("renders nothing when awards is null", () => {
    expect(render(null)).toBe("");
  });

  it("renders each non-null slot", () => {
    const awards: Awards = {
      mvp: ref("Alpha", 20),
      scorer: ref("Bravo", 200),
      rebounds: ref("Charlie", 150),
      assists: ref("Delta", 100),
      shooting: ref("Echo", 0.6),
    };
    const html = render(awards);
    expect(html).toMatch(/MVP/);
    expect(html).toMatch(/Top Scorer/);
    expect(html).toMatch(/Rebounds/);
    expect(html).toMatch(/Assists/);
    expect(html).toMatch(/Shooting/);
    expect(html).toMatch(/Alpha/);
    expect(html).toMatch(/Echo/);
  });

  it("hides null slots and renders remaining ones", () => {
    const awards: Awards = {
      mvp: null,
      scorer: ref("Bravo", 200),
      rebounds: null,
      assists: null,
      shooting: null,
    };
    const html = render(awards);
    expect(html).not.toMatch(/MVP/);
    expect(html).toMatch(/Top Scorer/);
    expect(html).toMatch(/Bravo/);
  });

  it("renders nothing when every slot is null", () => {
    const awards: Awards = {
      mvp: null, scorer: null, rebounds: null, assists: null, shooting: null,
    };
    expect(render(awards)).toBe("");
  });
});
