import { describe, it, expect } from "vitest";
import { buildHtml, buildText, type Game, type PlayerSlot } from "@/server/integrations/email/templates";

const game: Game = {
  opponent:     "Παναθηναϊκός",
  scheduledFor: "2026-05-03T19:00",
  location:     "home",
  competition:  "Α2 Εθνική",
  notes:        null,
};

const APP_URL    = "https://armani-katehano.com";
const UNSUB_URL  = "https://armani-katehano.com/unsubscribe?token=demo";

function rosterRowOrder(html: string): number[] {
  const out: number[] = [];
  const re = /#(\d+)<\/td>/g;
  let m;
  while ((m = re.exec(html)) !== null) out.push(Number(m[1]));
  return out;
}

function tableCount(html: string): number {
  return (html.match(/border:1px solid #e5e7eb/g) ?? []).length;
}

function gapIdx(html: string): number {
  return html.indexOf("height:14px");
}

describe("buildHtml -- roster ordering and starter/bench split", () => {
  it("orders all players ascending by jersey number when no starters are marked", () => {
    const players: PlayerSlot[] = [
      { number: 11, name: "P11", note: null },
      { number: 4,  name: "P4",  note: null },
      { number: 23, name: "P23", note: null },
      { number: 7,  name: "P7",  note: null },
    ];
    const html = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    expect(rosterRowOrder(html)).toEqual([4, 7, 11, 23]);
    expect(tableCount(html)).toBe(1);
    expect(gapIdx(html)).toBe(-1);
  });

  it("renders two bordered tables with a gap between when both groups exist, each sorted ascending", () => {
    const players: PlayerSlot[] = [
      { number: 11, name: "Starter11", note: "starting" },
      { number: 4,  name: "Starter4",  note: "Starting" },
      { number: 23, name: "Bench23",   note: null },
      { number: 7,  name: "Starter7",  note: "STARTER" },
      { number: 9,  name: "Bench9",    note: "captain" },
      { number: 2,  name: "Starter2",  note: "start" },
    ];
    const html  = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    const order = rosterRowOrder(html);
    expect(order).toEqual([2, 4, 7, 11, 9, 23]);

    expect(tableCount(html)).toBe(2);
    const gIdx  = gapIdx(html);
    const idx11 = html.indexOf("#11</td>");
    const idx9  = html.indexOf("#9</td>");
    expect(idx11).toBeGreaterThan(-1);
    expect(idx9).toBeGreaterThan(-1);
    expect(gIdx).toBeGreaterThan(idx11);
    expect(gIdx).toBeLessThan(idx9);
  });

  it("renders a single table when every player is a starter", () => {
    const players: PlayerSlot[] = [
      { number: 5, name: "A", note: "starting" },
      { number: 1, name: "B", note: "starter" },
    ];
    const html = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    expect(rosterRowOrder(html)).toEqual([1, 5]);
    expect(tableCount(html)).toBe(1);
    expect(gapIdx(html)).toBe(-1);
  });

  it("renders a single table when no player is a starter (note present but not starter-ish)", () => {
    const players: PlayerSlot[] = [
      { number: 5, name: "A", note: "captain" },
      { number: 1, name: "B", note: null },
    ];
    const html = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    expect(tableCount(html)).toBe(1);
    expect(gapIdx(html)).toBe(-1);
  });

  it("escapes HTML-significant characters in player name and note", () => {
    const players: PlayerSlot[] = [
      { number: 1, name: `<script>alert("x")</script>`, note: `O'Brien & Co` },
    ];
    const html = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("O&#39;Brien &amp; Co");
  });

  it("ignores leading/trailing whitespace when detecting a starter note", () => {
    const players: PlayerSlot[] = [
      { number: 9, name: "Bench9",   note: null },
      { number: 3, name: "Starter3", note: "  starting  " },
    ];
    const html = buildHtml(game, players, null, APP_URL, UNSUB_URL);
    expect(rosterRowOrder(html)).toEqual([3, 9]);
    expect(tableCount(html)).toBe(2);
    expect(gapIdx(html)).toBeGreaterThan(-1);
  });
});

describe("buildText -- roster ordering and starter/bench split", () => {
  it("lists starters first, then a divider, then bench -- each ascending by number", () => {
    const players: PlayerSlot[] = [
      { number: 11, name: "Starter11", note: "starting" },
      { number: 4,  name: "Starter4",  note: "starting" },
      { number: 23, name: "Bench23",   note: null },
      { number: 9,  name: "Bench9",    note: null },
      { number: 7,  name: "Starter7",  note: "starting" },
    ];
    const text  = buildText(game, players, null, APP_URL, UNSUB_URL);
    const lines = text.split("\n").map(l => l.trim()).filter(l => /^#\d+|·{4,}/.test(l));
    expect(lines[0]).toMatch(/^#4\b/);
    expect(lines[1]).toMatch(/^#7\b/);
    expect(lines[2]).toMatch(/^#11\b/);
    expect(lines[3]).toMatch(/^·{4,}$/);
    expect(lines[4]).toMatch(/^#9\b/);
    expect(lines[5]).toMatch(/^#23\b/);
  });

  it("omits the text divider when only one group is present", () => {
    const players: PlayerSlot[] = [
      { number: 5, name: "A", note: null },
      { number: 1, name: "B", note: null },
    ];
    const text = buildText(game, players, null, APP_URL, UNSUB_URL);
    expect(text).not.toMatch(/·{4,}/);
  });
});
