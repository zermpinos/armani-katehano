import { describe, it, expect } from "vitest";
import {
  buildGameImportedHtml,
  buildGameImportedText,
  type GameImportedGame,
  type TopPerformer,
  type GameEmailContext,
} from "@/server/integrations/email/templates/game-imported";

const NULL_CTX: GameEmailContext = { teamStats: null, record: null, nextGame: null };

const FULL_CTX: GameEmailContext = {
  teamStats: { fgPct: 38, teamReb: 24, teamTov: 11 },
  record:    { wins: 17, losses: 18 },
  nextGame: {
    opponent:     "Panathinaikos",
    scheduledFor: new Date("2026-06-01T18:00:00.000Z"),
    location:     "home",
    venue:        null,
  },
};

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

const WIN_GAME: GameImportedGame = { ...GAME, result: "W", teamScore: 78, opponentScore: 65 };

const PERFORMERS: TopPerformer[] = [
  { number: 7,  name: "M. Katehano",  position: "Guard",   photoUrl: null, pts: 18, reb: 5,  ast: 4 },
  { number: 11, name: "J. Rossi",     position: "Forward", photoUrl: null, pts: 14, reb: 9,  ast: 2 },
  { number: 23, name: "A. Lemos",     position: "Center",  photoUrl: null, pts: 11, reb: 7,  ast: 6 },
];

const APP_URL = "https://armani-katehano.com";
const UNSUB   = `${APP_URL}/unsubscribe?token=t`;

// ── Core structure ────────────────────────────────────────────────────────────

it("declares lang=en", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain('lang="en"');
});

it("contains a preheader span with Final · score summary", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/<span style="display:none[^"]*">[^<]*Final[^<]*53-73 \(L\)[^<]*<\/span>/);
});

it("wraps body in MSO conditional comments", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("<!--[if mso]>");
  expect(html).toContain("<![endif]-->");
});

it("<title> includes matchup and score", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/<title>@ Dragons 53-73 \(L\)<\/title>/);
});

// ── Header (section ①) ────────────────────────────────────────────────────────

it("header cell has dark #111111 background with bgcolor fallback", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/bgcolor="#111111"[^>]*style="[^"]*background-color:#111111/);
});

it("header includes the logo img pointing to /logohighres.png", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(`src="${APP_URL}/logohighres.png"`);
  expect(html).toContain('width="52"');
  expect(html).toContain('border="0"');
});

it("header contains ARMANI KATEHANO brand label in #c92a2a", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("color:#c92a2a");
  expect(html).toContain("Armani Katehano");
});

it("header shows competition when present", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("Δ&#39; Εθνική 2025-26");
});

it("has a 3px red separator row between header and sub-header", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/bgcolor="#c92a2a"[^>]*style="[^"]*background-color:#c92a2a[^"]*height:3px/);
});

// ── Sub-header (section ②) ────────────────────────────────────────────────────

it("sub-header contains GAME RECAP, the date, and the matchup", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html.toUpperCase()).toContain("GAME RECAP");
  expect(html).toContain("Saturday, 16 May 2026");
  expect(html).toContain("@ Dragons");
});

it("sub-header cell uses #1c1c1c background with bgcolor fallback", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/bgcolor="#1c1c1c"[^>]*style="[^"]*background-color:#1c1c1c/);
});

// ── Score (section ③) ─────────────────────────────────────────────────────────

it("score section uses #1a1a1a background with bgcolor fallback", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/bgcolor="#1a1a1a"[^>]*style="[^"]*background-color:#1a1a1a/);
});

it("score section has FINAL label", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(">Final<");
});

it("away game: AK is left of opponent in score section", () => {
  // GAME.location === "away" → AK (away) on left, opponent (home) on right
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  const scoreStart = html.indexOf("bgcolor=\"#1a1a1a\"");
  const akIdx  = html.indexOf(">AK<", scoreStart);
  const oppIdx = html.indexOf(">Dragons<", scoreStart);
  expect(akIdx).toBeLessThan(oppIdx);
});

it("home game: opponent is left of AK in score section", () => {
  const homeGame = { ...GAME, location: "home" };
  const html = buildGameImportedHtml(homeGame, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  const scoreStart = html.indexOf("bgcolor=\"#1a1a1a\"");
  const akIdx  = html.indexOf(">AK<", scoreStart);
  const oppIdx = html.indexOf(">Dragons<", scoreStart);
  expect(oppIdx).toBeLessThan(akIdx);
});

it("on loss: opponent score color is white, AK score color is gray", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  const scoreSection = html.slice(html.indexOf("bgcolor=\"#1a1a1a\""));
  expect(scoreSection).toContain("color:#ffffff");
  expect(scoreSection).toContain("color:#4b5563");
});

it("on win: W pill is green (#16a34a)", () => {
  const html = buildGameImportedHtml(WIN_GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/background:#16a34a[^"]*"[^>]*>W</);
});

it("on loss: L pill is red (#c92a2a)", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/background:#c92a2a[^"]*"[^>]*>L</);
});

it("opponent label is truncated to 12 chars for long names", () => {
  const g = { ...GAME, opponent: "Panathinaikos B.C." };
  const html = buildGameImportedHtml(g, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(">Panathinaiko<");
  expect(html).not.toContain(">Panathinaikos<");
});

it("escapes opponent and player names", () => {
  const html = buildGameImportedHtml(
    { ...GAME, opponent: "Evil<script>" },
    [{ number: 99, name: "<img src=x>", position: "Guard", photoUrl: null, pts: 1, reb: 0, ast: 0 }],
    NULL_CTX, APP_URL, UNSUB,
  );
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img src=x>");
  expect(html).toContain("&lt;script&gt;");
});

it("score block shows competition and venue in meta strip", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("Δ&#39; Εθνική 2025-26");
  expect(html).toContain("Basketcity Arena");
});

it("score block omits meta strip when both competition and venue are null", () => {
  const g = { ...GAME, competition: null, venueNote: null };
  const html = buildGameImportedHtml(g, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).not.toContain("Basketcity");
});

// ── Stats strip (section ④) ───────────────────────────────────────────────────

it("stats strip is absent when ctx.teamStats is null", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html.toUpperCase()).not.toContain("FIELD GOAL");
});

it("stats strip shows FG%, REB, TOV when ctx.teamStats is present", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html.toUpperCase()).toContain("FIELD GOAL");
  expect(html).toContain("38%");
  expect(html).toContain(">24<");
  expect(html).toContain(">11<");
});

it("TOV value renders in #c92a2a", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/color:#c92a2a[^>]*>[^<]*11[^<]*<\/p>/);
});

it("FG% shows dash when fgPct is null", () => {
  const ctx: GameEmailContext = { ...FULL_CTX, teamStats: { fgPct: null, teamReb: 20, teamTov: 5 } };
  const html = buildGameImportedHtml(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html).toContain("—");
});

// ── Top performers (section ⑤) ────────────────────────────────────────────────

it("performer table has header row with Pos, Pts, Reb, Ast columns", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(">Pos<");
  expect(html).toContain(">Pts<");
  expect(html).toContain(">Reb<");
  expect(html).toContain(">Ast<");
});

it("renders player initials in the avatar cell when photoUrl is null", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(">MK<");
  expect(html).toContain(">JR<");
  expect(html).toContain(">AL<");
});

it("renders player photo img when photoUrl is set, falls back to initials when null", () => {
  const mixed: TopPerformer[] = [
    { ...PERFORMERS[0]!, photoUrl: "https://cdn.example.com/mk.jpg" },
    { ...PERFORMERS[1]!, photoUrl: null },
    { ...PERFORMERS[2]!, photoUrl: null },
  ];
  const html = buildGameImportedHtml(GAME, mixed, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain('src="https://cdn.example.com/mk.jpg"');
  expect(html).not.toContain(">MK<");
  expect(html).toContain(">JR<");
});

it("avatar cell has dark #111111 background with bgcolor fallback", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/bgcolor="#111111"[^>]*style="[^"]*background-color:#111111[^"]*border-radius/);
});

it("shows position text when position is non-empty", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("Guard");
  expect(html).toContain("Forward");
  expect(html).toContain("Center");
});

it("highlights top PTS, REB, AST values in #c92a2a", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/color:#c92a2a[^>]*>18</);
  expect(html).toMatch(/color:#c92a2a[^>]*>9</);
  expect(html).toMatch(/color:#c92a2a[^>]*>6</);
});

it("non-max stat values render in #374151", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/color:#374151[^>]*>14</);
});

it("handles fewer than 3 top performers without error", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS.slice(0, 1), NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("M. Katehano");
  expect(html).not.toContain("J. Rossi");
});

// ── CTA (section ⑥) ──────────────────────────────────────────────────────────

it("CTA button links to /games/<id>", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain(`${APP_URL}/games/${GAME.id}`);
  expect(html).toContain("View full box score");
});

it("CTA button background is #c92a2a", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toMatch(/href="[^"]*\/games\/g1"[^>]*style="[^"]*background[^"]*#c92a2a/);
});

// ── Footer bar (section ⑦) ────────────────────────────────────────────────────

it("record+next-game bar is absent when both ctx.record and ctx.nextGame are null", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html.toUpperCase()).not.toContain("RECORD");
});

it("record section shows W and L numbers when ctx.record is present", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("17");
  expect(html).toContain("18");
  expect(html.toUpperCase()).toContain("RECORD");
});

it("win-rate percentage is shown when wins+losses > 0", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("48.6%");
});

it("win-rate percentage is omitted when wins+losses === 0", () => {
  const ctx: GameEmailContext = { ...FULL_CTX, record: { wins: 0, losses: 0 } };
  const html = buildGameImportedHtml(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html).not.toContain("48.6%");
});

it("next game shows opponent when ctx.nextGame is present", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("Panathinaikos");
  expect(html.toUpperCase()).toContain("NEXT");
});

it("calendar buttons are present when nextGame is not null", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("calendar.google.com");
  expect(html).toContain("/api/calendar/ics");
});

it("ICS URL opponent param is encodeURIComponent-encoded", () => {
  const ctx: GameEmailContext = {
    ...FULL_CTX,
    nextGame: { opponent: "Team & Bros", scheduledFor: new Date("2026-06-01T18:00:00.000Z"), location: "home", venue: null },
  };
  const html = buildGameImportedHtml(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html).toContain("Team%20%26%20Bros");
  expect(html).not.toContain("opponent=Team & Bros");
});

it("footer bar uses #111111 background (header and footer both dark)", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  const matches = html.match(/bgcolor="#111111"/g);
  expect(matches).toBeTruthy();
  expect(matches!.length).toBeGreaterThanOrEqual(2);
});

it("record section renders even when nextGame is null", () => {
  const ctx: GameEmailContext = { teamStats: null, record: { wins: 5, losses: 3 }, nextGame: null };
  const html = buildGameImportedHtml(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html.toUpperCase()).toContain("RECORD");
  expect(html).not.toContain("calendar.google.com");
});

it("record section shows competition name as context for the record", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
  const lastDark = html.lastIndexOf('bgcolor="#111111"');
  expect(html.slice(lastDark)).toContain("Δ&#39; Εθνική 2025-26");
});

it("record section omits competition subtitle when competition is null", () => {
  const g = { ...GAME, competition: null };
  const ctx: GameEmailContext = { teamStats: null, record: { wins: 3, losses: 1 }, nextGame: null };
  const html = buildGameImportedHtml(g, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html.toUpperCase()).toContain("RECORD");
  expect(html).toContain("3");
});

it("next game section renders even when record is null", () => {
  const ctx: GameEmailContext = {
    teamStats: null, record: null,
    nextGame: { opponent: "Aris", scheduledFor: new Date("2026-06-01T18:00:00.000Z"), location: "away", venue: null },
  };
  const html = buildGameImportedHtml(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
  expect(html).toContain("Aris");
  expect(html).toContain("calendar.google.com");
});

// ── Legal footer (section ⑧) ─────────────────────────────────────────────────

it("legal footer has privacy link and unsubscribe link", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("Privacy notice");
  expect(html).toMatch(/href="https:\/\/armani-katehano\.com\/privacy"/);
  expect(html).toContain(UNSUB);
});

it("legal footer reads 'You received this email because you subscribed...'", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("You received this email because you subscribed to Armani Katehano game emails");
});

it("legal footer cell uses #f9fafb surface background", () => {
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
  expect(html).toContain("background:#f9fafb");
});

it("escapes ampersands in unsubscribe URL", () => {
  const evilUnsub = "https://example.com/unsubscribe?a=b&c=d";
  const html = buildGameImportedHtml(GAME, PERFORMERS, NULL_CTX, APP_URL, evilUnsub);
  expect(html).toContain("a=b&amp;c=d");
  expect(html).not.toContain("a=b&c=d");
});

// ── buildGameImportedText ─────────────────────────────────────────────────────

describe("buildGameImportedText — new sections", () => {
  it("leads with ARMANI KATEHANO · GAME RECAP", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text.split("\n")[0]).toBe("ARMANI KATEHANO · GAME RECAP");
  });

  it("away game: AK is left of opponent in score grid", () => {
    // GAME.location === "away" → AK (away) on left, opponent (home) on right
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).toMatch(/AK\s+Dragons/);
    expect(text).toMatch(/53\s+73/);
  });

  it("home game: opponent is left of AK in score grid", () => {
    const homeGame = { ...GAME, location: "home" };
    const text = buildGameImportedText(homeGame, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).toMatch(/Dragons\s+AK/);
    expect(text).toMatch(/73\s+53/);
  });

  it("includes Pos column in performer header when any performer has a position", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).toMatch(/Player\s+Pos\s+Pts/);
  });

  it("includes team stats section when ctx.teamStats is present", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
    expect(text).toContain("TEAM STATS");
    expect(text).toContain("FG%: 38%");
    expect(text).toContain("REB: 24");
    expect(text).toContain("TOV: 11");
  });

  it("omits team stats section when ctx.teamStats is null", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).not.toContain("TEAM STATS");
    expect(text).not.toContain("FG%:");
  });

  it("includes record and win rate when ctx.record is present and wins+losses > 0", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
    expect(text).toMatch(/Current Record[^:]*:\s+17.18\s+\(48\.6%/);
  });

  it("shows record without win rate when wins+losses === 0", () => {
    const ctx: GameEmailContext = { ...FULL_CTX, record: { wins: 0, losses: 0 } };
    const text = buildGameImportedText(GAME, PERFORMERS, ctx, APP_URL, UNSUB);
    expect(text).toMatch(/Current Record[^:]*:\s+0.0/);
    expect(text).not.toContain("win rate");
  });

  it("includes next game line and Google Calendar URL when ctx.nextGame is present", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
    expect(text).toContain("Panathinaikos");
    expect(text).toContain("calendar.google.com");
  });

  it("omits record and next game section when both are null", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).not.toContain("Record:");
    expect(text).not.toContain("Next:");
  });

  it("contains no em-dashes", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, FULL_CTX, APP_URL, UNSUB);
    expect(text).not.toMatch(/—/);
  });

  it("contains the full box score URL", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).toContain(`Full box score:  ${APP_URL}/games/g1`);
  });

  it("contains privacy and unsubscribe lines", () => {
    const text = buildGameImportedText(GAME, PERFORMERS, NULL_CTX, APP_URL, UNSUB);
    expect(text).toMatch(/Privacy notice\s+https:\/\/armani-katehano\.com\/privacy/);
    expect(text).toMatch(/Unsubscribe\s+https:\/\/armani-katehano\.com\/unsubscribe/);
  });
});
