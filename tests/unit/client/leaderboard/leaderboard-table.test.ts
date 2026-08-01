import { describe, it, expect } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { COLS, TOTAL_COLS, buildGroupRow, LeaderboardTable } from "@/client/leaderboard/leaderboard-table";

describe("COLS / TOTAL_COLS - default/group bookkeeping", () => {
  it("every COLS entry has a unique key", () => {
    const keys = COLS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("every TOTAL_COLS entry has a unique key", () => {
    const keys = TOTAL_COLS.map(c => c.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("COLS includes tsPct marked as default", () => {
    const tsPct = COLS.find(c => c.key === "tsPct");
    expect(tsPct).toBeDefined();
    expect(tsPct.default).toBe(true);
  });

  it("TOTAL_COLS includes pf_total, not marked default", () => {
    const pfTotal = TOTAL_COLS.find(c => c.key === "pf_total");
    expect(pfTotal).toBeDefined();
    expect(pfTotal.default).toBeFalsy();
  });

  it("every non-default COLS entry has a group", () => {
    for (const col of COLS) {
      if (!col.default) expect(col.group, `${col.key} has no group`).toBeTruthy();
    }
  });

  it("every non-default TOTAL_COLS entry has a group", () => {
    for (const col of TOTAL_COLS) {
      if (!col.default) expect(col.group, `${col.key} has no group`).toBeTruthy();
    }
  });
});

// Regression guard: this refactor rewrites both arrays from scratch to add
// default/group/tooltip flags. It is easy to transcribe one entry wrong
// (drop a key, typo a key) without anything else catching it - assert the
// full pre-existing key set survives, independent of default/group values.
describe("COLS / TOTAL_COLS - no column dropped from the pre-existing set", () => {
  it("COLS retains every original per-game stat key", () => {
    const original = ["gp","mpg","ppg","ftPct","fgPct","fg2Pct","fg3Pct","apg","rpg","orpg","drpg","spg","bpg","tpg","fpg","eff"];
    const keys = COLS.map(c => c.key);
    for (const key of original) expect(keys, `missing ${key}`).toContain(key);
  });

  it("TOTAL_COLS retains every original totals stat key", () => {
    const original = ["gp","pts_total","reb_total","ast_total","stl_total","fgm","fga","fgPct","fg3m","fg3a","fg3Pct","ftm","fta","ftPct","fg2Pct"];
    const keys = TOTAL_COLS.map(c => c.key);
    for (const key of original) expect(keys, `missing ${key}`).toContain(key);
  });
});

describe("buildGroupRow", () => {
  it("merges consecutive columns sharing the same group into one span", () => {
    const cols = [
      { key: "a", group: undefined },
      { key: "b", group: undefined },
      { key: "c", group: "SHOOTING" },
      { key: "d", group: "SHOOTING" },
      { key: "e", group: "DEFENSE" },
    ];
    expect(buildGroupRow(cols as any)).toEqual([
      { label: null, span: 2 },
      { label: "SHOOTING", span: 2 },
      { label: "DEFENSE", span: 1 },
    ]);
  });

  it("does not merge across a null gap even if the group label repeats later", () => {
    const cols = [
      { key: "a", group: "SHOOTING" },
      { key: "b", group: undefined },
      { key: "c", group: "SHOOTING" },
    ];
    expect(buildGroupRow(cols as any)).toEqual([
      { label: "SHOOTING", span: 1 },
      { label: null, span: 1 },
      { label: "SHOOTING", span: 1 },
    ]);
  });

  it("spans sum to the input length for COLS", () => {
    const total = buildGroupRow(COLS).reduce((s, g) => s + g.span, 0);
    expect(total).toBe(COLS.length);
  });

  it("spans sum to the input length for TOTAL_COLS", () => {
    const total = buildGroupRow(TOTAL_COLS).reduce((s, g) => s + g.span, 0);
    expect(total).toBe(TOTAL_COLS.length);
  });
});

function samplePlayer(overrides = {}) {
  return {
    id: "p1", slug: "p-one", name: "Test Player", number: 7, position: "G",
    stats: {
      gp: 10, ppg: 15.2, rpg: 5.1, apg: 3.4, eff: 12.0,
      fgPct: 45.0, tsPct: 55.5, ftPct: 78.0,
      mpg: 25.0, fg2Pct: 50.0, fg3Pct: 33.0, orpg: 1.0, drpg: 4.1,
      spg: 1.2, bpg: 0.4, tpg: 2.0, fpg: 2.3,
      fga: 100, fta: 20,
    },
    ...overrides,
  };
}

const renderTable = (props = {}) =>
  renderToStaticMarkup(
    createElement(LeaderboardTable, {
      sorted: [samplePlayer()],
      activeCols: COLS,
      sortKey: "ppg",
      sortDir: "desc",
      onSort: () => {},
      ...props,
    }),
  );

describe("LeaderboardTable - default (collapsed) render", () => {
  const html = renderTable();

  it("shows default column headers", () => {
    expect(html).toMatch(/>PPG/);
    expect(html).toMatch(/>TS%/);
    expect(html).toMatch(/>FT%/);
  });

  it("hides non-default column headers", () => {
    expect(html).not.toMatch(/>MPG/);
    expect(html).not.toMatch(/>FPG/);
    expect(html).not.toMatch(/>SPG/);
  });

  it("renders the TS% explanation text (present in DOM, hidden via CSS)", () => {
    expect(html).toMatch(/True Shooting % measures scoring efficiency/);
  });

  it("marks rank and player cells sticky", () => {
    expect(html).toMatch(/class="[^"]*sticky[^"]*left-0[^"]*"[^>]*>\s*#/s);
  });

  it("renders a more-stats toggle button", () => {
    expect(html).toMatch(/MORE STATS/);
  });

  it("does not render a group header row when collapsed", () => {
    expect(html).not.toMatch(/SHOOTING/);
  });
});
