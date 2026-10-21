import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ReviewForm } from "@/client/admin/import/ReviewForm";

const SEVERAL = "Several active leagues match this URL (a, b). Pick one under Game info.";
const GENERIC = "No league matched the source URL";
const SL = { id: "sl1", leagueName: "Super League", leagueSlug: "men", seasonName: "2026-27" };

const render = (seasonLeagueId: string, unresolved: string[]) => renderToStaticMarkup(createElement(ReviewForm, {
  draft: {
    date: "2026-10-04", opponent: "Rivals", home: true, result: "W", teamScore: 70, opponentScore: 60,
    seasonLeagueId, sourceUrl: null, boxScore: [],
  },
  phase: "review", gameState: null, gate: null, unresolved, entries: [], playedIds: new Set<string>(),
  onAssign: () => {}, onPlayerCreated: () => {}, youtubeUrl: "", setYoutubeUrl: () => {},
  players: [], seasonLeagues: [SL], updDraft: () => {}, updBox: () => {}, onSave: () => {}, onBack: () => {},
}));

const saveDisabled = (html: string) => /<button[^>]*disabled=""[^>]*>SAVE GAME</.test(html);
const count = (html: string, s: string) => html.split(s).length - 1;

describe("ReviewForm league blockers", () => {
  it("saves once a league is picked, whatever the server said", () => {
    const html = render("sl1", [SEVERAL]);
    expect(saveDisabled(html)).toBe(false);
    expect(html).not.toContain("Several active leagues");
    expect(html).not.toContain(GENERIC);
  });

  it("lists the server's league message once while none is picked", () => {
    const html = render("", [SEVERAL]);
    expect(count(html, "Several active leagues")).toBe(1);
    expect(html).not.toContain(GENERIC);
    expect(saveDisabled(html)).toBe(true);
  });

  it("falls back to the generic line when the server said nothing", () => {
    const html = render("", []);
    expect(count(html, GENERIC)).toBe(1);
    expect(saveDisabled(html)).toBe(true);
  });
});
