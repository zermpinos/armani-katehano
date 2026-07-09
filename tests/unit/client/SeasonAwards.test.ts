import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import SeasonAwards from "@/components/ui/SeasonAwards";
import type { Awards, PlayerRef } from "@/domain/awards";

const ref = (name: string, jersey: number, value: number): PlayerRef => ({
  playerId: name.toLowerCase(),
  playerName: name,
  playerSlug: name.toLowerCase(),
  playerNumber: jersey,
  value,
});

const emptyAwards: Awards = { mvp: [], scorer: [], rebounds: [], assists: [], shooting: [] };

const render = (awards: Awards | null) =>
  renderToStaticMarkup(createElement(SeasonAwards, { awards }));

describe("SeasonAwards", () => {
  it("renders nothing when awards is null", () => {
    expect(render(null)).toBe("");
  });

  it("renders nothing when every slot is empty", () => {
    expect(render(emptyAwards)).toBe("");
  });

  it("renders three podium rows for a full slot", () => {
    const awards: Awards = {
      ...emptyAwards,
      mvp: [
        ref("Panagiotis Zermpinos", 23, 15.3),
        ref("Anna Maria Kollia",     7, 14.8),
        ref("Kostas Player",        10, 14.1),
      ],
    };
    const html = render(awards);
    expect(html).toMatch(/MVP/);
    expect(html).toMatch(/🥇/);
    expect(html).toMatch(/🥈/);
    expect(html).toMatch(/🥉/);
    expect(html).toMatch(/#23/);
    expect(html).toMatch(/P\. Zermpinos/);
    expect(html).toMatch(/15\.3/);
    expect(html).toMatch(/A\. Maria Kollia/);
    expect(html).toMatch(/K\. Player/);
  });

  it("renders two podium rows when only silver + gold exist", () => {
    const awards: Awards = {
      ...emptyAwards,
      scorer: [
        ref("Alpha Player", 1, 200),
        ref("Bravo Player", 2, 150),
      ],
    };
    const html = render(awards);
    expect(html).toMatch(/🥇/);
    expect(html).toMatch(/🥈/);
    expect(html).not.toMatch(/🥉/);
  });

  it("renders one podium row when only a winner exists", () => {
    const awards: Awards = {
      ...emptyAwards,
      rebounds: [ref("Alpha Player", 1, 50)],
    };
    const html = render(awards);
    expect(html).toMatch(/🥇/);
    expect(html).not.toMatch(/🥈/);
    expect(html).not.toMatch(/🥉/);
    expect(html).toMatch(/50/);
  });

  it("hides empty slots but keeps non-empty ones", () => {
    const awards: Awards = {
      ...emptyAwards,
      assists: [ref("Alpha Player", 1, 100)],
    };
    const html = render(awards);
    expect(html).not.toMatch(/MVP/);
    expect(html).not.toMatch(/Top Scorer/);
    expect(html).toMatch(/Assists/);
    expect(html).toMatch(/100/);
  });

  it("formats scorer value as integer, MVP as one decimal, shooting as percent", () => {
    const awards: Awards = {
      ...emptyAwards,
      mvp:      [ref("Alpha", 1, 15.288)],
      scorer:   [ref("Bravo", 2, 200)],
      shooting: [ref("Delta", 4, 56.7)],
    };
    const html = render(awards);
    expect(html).toMatch(/15\.3/);
    expect(html).toMatch(/>200</);
    expect(html).toMatch(/56\.7%/);
  });
});
