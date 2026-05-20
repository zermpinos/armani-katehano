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

  it("HTML contains a preheader span with the final-score summary", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<span style="display:none[^"]*">[^<]*Final[^<]*53-73 \(L\)[^<]*<\/span>/);
  });

  it("HTML wraps the body in an Outlook MSO conditional", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toContain("<!--[if mso]>");
    expect(html).toContain("<![endif]-->");
  });

  it("HTML score block shows 'AK' label and the short opponent label", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/>AK<\/p>[\s\S]*>Dragons<\/p>/);
  });

  it("HTML score block truncates a long opponent label to 12 chars", () => {
    const g = { ...GAME, opponent: "Panathinaikos B.C." };
    const html = buildGameImportedHtml(g, PERFORMERS, APP_URL, UNSUB);
    // First whitespace-split token of "Panathinaikos B.C." is "Panathinaikos" (13 chars), truncated to 12: "Panathinaiko".
    expect(html).toContain(">Panathinaiko<");
    expect(html).not.toContain(">Panathinaikos<");
  });

  it("HTML performer table has a header row with #, Player, Pts, Reb, Ast columns", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<tr style="background:#f3f4f6;">[\s\S]*>#<\/td>[\s\S]*>Player<\/td>[\s\S]*>Pts<\/td>[\s\S]*>Reb<\/td>[\s\S]*>Ast<\/td>/);
  });

  it("HTML performer rows render pts, reb, ast as three separate right-aligned cells", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    // Tsioulkas: 16 pts, 7 reb, 1 ast — should appear as three separate cells, not "16 pts · 7 reb · 1 ast"
    expect(html).not.toContain("16 pts &middot; 7 reb &middot; 1 ast");
    expect(html).toMatch(/>Giorgos Tsioulkas<\/td>\s*<td[^>]*text-align:right[^>]*>16<\/td>\s*<td[^>]*text-align:right[^>]*>7<\/td>\s*<td[^>]*text-align:right[^>]*>1<\/td>/);
  });

  it("HTML no longer renders the standalone legend paragraph", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).not.toContain("# &middot; Player &middot; Pts &middot; Reb &middot; Ast");
  });

  it("HTML footer is in its own background-colored block with a top border", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<!-- Footer -->[\s\S]*background:#f9fafb[\s\S]*border-top:1px solid #e5e7eb/);
  });

  it("HTML footer includes a Privacy notice link beside Unsubscribe", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toContain("Privacy notice");
    expect(html).toMatch(/href="https:\/\/armani-katehano\.com\/privacy"/);
    expect(html).toContain(UNSUB);
  });

  it("HTML footer reads 'You received this email because you subscribed...'", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toContain("You received this email because you subscribed to Armani Katehano game emails");
  });

  it("HTML CTA uses letter-spacing and 14px 28px padding (matches roster)", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/padding:14px 28px[^;]*;[^"]*letter-spacing:0\.02em/);
  });

  it("HTML escapes ampersands in unsubscribe URL", () => {
    const evilUnsub = "https://example.com/unsubscribe?a=b&c=d";
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, evilUnsub);
    expect(html).toContain("a=b&amp;c=d");
    expect(html).not.toContain("a=b&c=d");
  });

  it("plain text leads with the ARMANI KATEHANO · GAME RECAP header", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text.split("\n")[0]).toBe("ARMANI KATEHANO · GAME RECAP");
  });

  it("plain text contains a TOP PERFORMERS · N section header", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text).toContain("TOP PERFORMERS · 3");
  });

  it("plain text includes a Result line, a Competition line, and a Venue line", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text).toMatch(/Result\s+53-73 \(L\)/);
    expect(text).toMatch(/Competition\s+Δ' Εθνική 2025-26/);
    expect(text).toMatch(/Venue\s+Basketcity Arena/);
  });

  it("plain text omits Competition and Venue lines when those fields are null", () => {
    const g = { ...GAME, competition: null, venueNote: null };
    const text = buildGameImportedText(g, PERFORMERS, APP_URL, UNSUB);
    expect(text).not.toContain("Competition");
    expect(text).not.toContain("Venue");
  });

  it("plain text contains a Privacy notice line and an Unsubscribe line", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text).toMatch(/Privacy notice\s+https:\/\/armani-katehano\.com\/privacy/);
    expect(text).toMatch(/Unsubscribe\s+https:\/\/armani-katehano\.com\/unsubscribe/);
  });

  it("plain text contains the full box score URL", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(text).toContain(`Full box score:  ${APP_URL}/games/g1`);
  });

  it("HTML header band shows a date subtitle under the matchup", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<p[^>]*color:#ffffff[^>]*>@ Dragons<\/p>\s*<p[^>]*color:#d1d5db[^>]*>Saturday, 16 May 2026<\/p>/);
  });

  it("HTML score block shows a FINAL eyebrow centered above the scores", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/<!-- Score -->[\s\S]*<p[^>]*text-align:center[^>]*>Final<\/p>/);
  });

  it("HTML score block contains the W/L pill between the AK and opponent scores", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    const scoreBlock = html.match(/<!-- Score -->[\s\S]*?<\/td><\/tr>/)?.[0] ?? "";
    expect(scoreBlock).toMatch(/background:#c92a2a[^"]*"[^>]*>L</);
    expect(scoreBlock).toMatch(/>AK<\/p>[\s\S]*background:#c92a2a[\s\S]*>Dragons<\/p>/);
  });

  it("HTML W pill renders with the brand-adjacent green", () => {
    const g = { ...GAME, result: "W" };
    const html = buildGameImportedHtml(g, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/background:#16a34a[^"]*"[^>]*>W</);
  });

  it("HTML pill uses 14px font and 6px 14px padding", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    expect(html).toMatch(/padding:6px 14px[^;]*;[^"]*font-size:14px/);
  });

  it("HTML score block meta strip shows competition and venue joined by a middot", () => {
    const html = buildGameImportedHtml(GAME, PERFORMERS, APP_URL, UNSUB);
    const scoreBlock = html.match(/<!-- Score -->[\s\S]*?<\/td><\/tr>/)?.[0] ?? "";
    expect(scoreBlock).toContain("Δ&#39; Εθνική 2025-26");
    expect(scoreBlock).toContain("Basketcity Arena");
    expect(scoreBlock).toMatch(/Δ&#39; Εθνική 2025-26[\s\S]*&middot;[\s\S]*Basketcity Arena/);
  });

  it("HTML score block omits the meta strip entirely when both competition and venue are null", () => {
    const g = { ...GAME, competition: null, venueNote: null };
    const html = buildGameImportedHtml(g, PERFORMERS, APP_URL, UNSUB);
    const scoreBlock = html.match(/<!-- Score -->[\s\S]*?<\/td><\/tr>/)?.[0] ?? "";
    expect(scoreBlock).not.toContain("Δ");
    expect(scoreBlock).not.toContain("Basketcity");
  });
});
