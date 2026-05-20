import { describe, it, expect } from "vitest";
import {
  buildGameImportedHtml,
  buildGameImportedText,
  type GameImportedGame,
  type TopPerformer,
} from "@/server/integrations/email/templates/game-imported";

const game: GameImportedGame = {
  id:            "game_xyz",
  opponent:      "Olympiacos B",
  location:      "home",
  teamScore:     78,
  opponentScore: 73,
  result:        "W",
  playedOn:      new Date("2026-05-15T19:00:00Z"),
  venueNote:     "Peristeri Arena",
  competition:   "A2 League",
};

const top: TopPerformer[] = [
  { number: 11, name: "Alex Papadopoulos", pts: 24, reb: 7,  ast: 5 },
  { number: 7,  name: "Nikos Ioannou",     pts: 18, reb: 4,  ast: 3 },
  { number: 4,  name: "Yannis Kostas",     pts: 12, reb: 10, ast: 2 },
];

const APP_URL          = "https://armani-katehano.com";
const UNSUBSCRIBE_URL  = "https://armani-katehano.com/unsubscribe?token=unsubtok";

const GAME: GameImportedGame = {
  id:            "g1",
  opponent:      "Dragons",
  location:      "away",
  teamScore:     53,
  opponentScore: 73,
  result:        "L",
  playedOn:      new Date("2026-05-16T18:00:00Z"),
  venueNote:     "Basketcity Arena",
  competition:   "Δ' Εθνική 2025-26",
};

const PERFORMERS: TopPerformer[] = [
  { number: 14, name: "Giorgos Tsioulkas",         pts: 16, reb: 7, ast: 1 },
  { number: 77, name: "Andreas Papadimitriou",     pts: 14, reb: 4, ast: 2 },
  { number:  3, name: "Stathis Christofilopoulos", pts: 11, reb: 3, ast: 1 },
];

const UNSUB = `${APP_URL}/unsubscribe?token=t`;

describe("game-imported email template", () => {
  it("buildHtml contains matchup, score, all top performers, CTA, unsubscribe", () => {
    const html = buildGameImportedHtml(game, top, APP_URL, UNSUBSCRIBE_URL);
    expect(html).toContain("vs Olympiacos B");
    expect(html).toContain("78");
    expect(html).toContain("73");
    expect(html).toContain("Alex Papadopoulos");
    expect(html).toContain("Nikos Ioannou");
    expect(html).toContain("Yannis Kostas");
    expect(html).toContain(`${APP_URL}/games/${game.id}`);
    expect(html).toContain(UNSUBSCRIBE_URL);
  });

  it("buildHtml uses '@' prefix for away games", () => {
    const html = buildGameImportedHtml({ ...game, location: "away" }, top, APP_URL, UNSUBSCRIBE_URL);
    expect(html).toContain("@ Olympiacos B");
    expect(html).not.toContain("vs Olympiacos B");
  });

  it("buildHtml renders loss styling for L result", () => {
    const html = buildGameImportedHtml({ ...game, result: "L", teamScore: 70, opponentScore: 80 }, top, APP_URL, UNSUBSCRIBE_URL);
    expect(html).toContain("70");
    expect(html).toContain("80");
    expect(html).toMatch(/L\b/);
  });

  it("buildHtml escapes opponent and player names", () => {
    const html = buildGameImportedHtml(
      { ...game, opponent: "Evil<script>" },
      [{ number: 99, name: "<img src=x>", pts: 1, reb: 0, ast: 0 }],
      APP_URL, UNSUBSCRIBE_URL,
    );
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("<img src=x>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("&lt;img");
  });

  it("buildHtml handles fewer than 3 top performers without erroring", () => {
    const html = buildGameImportedHtml(game, top.slice(0, 1), APP_URL, UNSUBSCRIBE_URL);
    expect(html).toContain("Alex Papadopoulos");
    expect(html).not.toContain("Nikos Ioannou");
  });

  it("buildText contains matchup, score, players, CTA URL, unsubscribe URL", () => {
    const text = buildGameImportedText(game, top, APP_URL, UNSUBSCRIBE_URL);
    expect(text).toContain("vs Olympiacos B");
    expect(text).toContain("78");
    expect(text).toContain("73");
    expect(text).toContain("Alex Papadopoulos");
    expect(text).toContain(`${APP_URL}/games/${game.id}`);
    expect(text).toContain(UNSUBSCRIBE_URL);
  });

  it("HTML declares lang=en", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toContain('lang="en"');
    expect(html).not.toContain('lang="el"');
  });

  it("HTML <title> includes matchup and final score", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<title>@ Dragons 53-73 \(L\)<\/title>/);
  });

  it("HTML eyebrow reads 'Armani Katehano · Game Recap'", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toContain("Armani Katehano &middot; Game Recap");
  });

  it("plain text contains no em-dashes anywhere", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text).not.toMatch(/—/);
  });
});
