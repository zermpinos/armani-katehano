import { describe, it, expect } from "vitest";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";

const BASE_URL = "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/TEST";

// ─── HTML building blocks ────────────────────────────────────────────────────

function gameHeader(opts: {
  home?: string;
  away?: string;
  homeScore?: string | number | null;
  awayScore?: string | number | null;
  date?: string;
} = {}) {
  return `
    <div class="name">${opts.home ?? "ARMANI KATEHANO"}</div>
    <div class="name">${opts.away ?? "ΑΡΗΣ"}</div>
    <span id="gameScoreHome">${opts.homeScore ?? "39"}</span>
    <span id="gameScoreVisitor">${opts.awayScore ?? "45"}</span>
    <span id="gameDate">${opts.date ?? "Κυριακή, 14 Απριλίου 2026"}</span>
    <span id="gameTime">18:00</span>
    <span id="stadiumname">Γήπεδο: Τεστ</span>
  `;
}

function quarterTable(rows: [number, string, number][]) {
  return `<table>${rows.map(([h, q, a]) =>
    `<tr><td>${h}</td><td>${q}</td><td>${a}</td></tr>`
  ).join("")}</table>`;
}

const PER_QUARTER_TABLE = quarterTable([
  [8, "Q1", 5],
  [11, "Q2", 19],
  [6, "Q3", 12],
  [14, "Q4", 9],
]);

const CUMULATIVE_TABLE = quarterTable([
  [8,  "Q1", 5],
  [19, "Q2", 24],
  [25, "Q3", 36],
  [39, "Q4", 45],
]);

function playerSection(teamName: string, players: string, totals: string) {
  return `
    <div class="originalstats">
      <div class="statistics_boxscore">
        <div>${teamName}</div>
        <table class="statsfull comparative">
          <tr>
            <th>#</th><th>Players</th><th>ST</th><th>MIN</th>
            <th>PTS</th><th>REB</th><th>OREB</th><th>DREB</th>
            <th>AST</th><th>STL</th><th>BLK</th><th>TO</th><th>PF</th>
            <th>2PTS</th><th>3PTS</th><th>FT</th><th>FG</th>
          </tr>
          ${players}
          <tr>
            <td>TOTALS</td>
            <td></td><td></td><td>100:00</td>
            ${totals}
          </tr>
        </table>
      </div>
    </div>
  `;
}

function playerRow(num: number, name: string, min: string, pts: number, opts: {
  reb?: number; oreb?: number; dreb?: number; ast?: number;
  stl?: number; blk?: number; to?: number; pf?: number;
  fg2m?: number; fg2a?: number; fg3m?: number; fg3a?: number;
  ftm?: number; fta?: number; starter?: boolean;
} = {}) {
  const { reb=0, oreb=0, dreb=0, ast=0, stl=0, blk=0, to=0, pf=0,
          fg2m=0, fg2a=0, fg3m=0, fg3a=0, ftm=0, fta=0, starter=true } = opts;
  const st = starter ? "*" : "";
  return `
    <tr>
      <td>${num}</td>
      <td><a href="/player/${num}">${name}</a></td>
      <td>${st}</td><td>${min}</td>
      <td>${pts}</td><td>${reb}</td><td>${oreb}</td><td>${dreb}</td>
      <td>${ast}</td><td>${stl}</td><td>${blk}</td><td>${to}</td><td>${pf}</td>
      <td><span class="bold">${fg2m} / ${fg2a}</span></td>
      <td><span class="bold">${fg3m} / ${fg3a}</span></td>
      <td><span class="bold">${ftm} / ${fta}</span></td>
      <td><span class="bold">${fg2m + fg3m} / ${fg2a + fg3a}</span></td>
    </tr>
  `;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("scrapeGame -- finalScore", () => {
  it("parses home and away final scores", () => {
    const html = gameHeader({ homeScore: 39, awayScore: 45 });
    const result = scrapeGame(html, BASE_URL);
    expect(result.game.finalScore).toEqual({ home: 39, away: 45 });
  });

  it("returns null for missing final score", () => {
    const html = gameHeader({ homeScore: "", awayScore: "" });
    const result = scrapeGame(html, BASE_URL);
    expect(result.game.finalScore.home).toBeNull();
    expect(result.game.finalScore.away).toBeNull();
  });
});

describe("scrapeGame -- team names", () => {
  it("parses homeTeam and awayTeam from .name divs", () => {
    const html = gameHeader({ home: "ARMANI KATEHANO", away: "ΑΡΗΣ" });
    const result = scrapeGame(html, BASE_URL);
    expect(result.game.homeTeam).toBe("ARMANI KATEHANO");
    expect(result.game.awayTeam).toBe("ΑΡΗΣ");
  });
});

describe("scrapeGame -- quarter score table selection (regression)", () => {
  it("picks per-quarter table when both per-quarter and cumulative tables are present", () => {
    // CRITICAL: the page has two 4-row Q1-Q4 tables.
    // Per-quarter sums: home 8+11+6+14=39, away 5+19+12+9=45 -- matches finalScore.
    // Cumulative sums: home 8+19+25+39=91, away 5+24+36+45=110 -- does not match.
    const html = gameHeader({ homeScore: 39, awayScore: 45 })
      + PER_QUARTER_TABLE
      + CUMULATIVE_TABLE;

    const result = scrapeGame(html, BASE_URL);

    expect(result.game.quarterScores).toHaveLength(4);
    expect(result.game.quarterScores[0]).toMatchObject({ quarter: "Q1", home: 8,  away: 5  });
    expect(result.game.quarterScores[1]).toMatchObject({ quarter: "Q2", home: 11, away: 19 });
    expect(result.game.quarterScores[2]).toMatchObject({ quarter: "Q3", home: 6,  away: 12 });
    expect(result.game.quarterScores[3]).toMatchObject({ quarter: "Q4", home: 14, away: 9  });
  });

  it("does NOT pick cumulative table (Q4 values would match final score, not per-quarter values)", () => {
    const html = gameHeader({ homeScore: 39, awayScore: 45 })
      + PER_QUARTER_TABLE
      + CUMULATIVE_TABLE;

    const result = scrapeGame(html, BASE_URL);

    // Cumulative Q4 values equal the final score (39/45) -- the old bug was picking this.
    // After the fix, Q4 home must be 14, not 39.
    expect(result.game.quarterScores[3].home).toBe(14);
    expect(result.game.quarterScores[3].away).toBe(9);
  });

  it("falls back to first candidate when finalScore is absent (live/pre-game page)", () => {
    const html = gameHeader({ homeScore: "", awayScore: "" })
      + PER_QUARTER_TABLE
      + CUMULATIVE_TABLE;

    const result = scrapeGame(html, BASE_URL);
    // No score to match against -- first table is used (per-quarter appears first on page)
    expect(result.game.quarterScores).toHaveLength(4);
    expect(result.game.quarterScores[0]).toMatchObject({ quarter: "Q1" });
  });

  it("handles a single quarter table (no cumulative table present)", () => {
    const html = gameHeader({ homeScore: 75, awayScore: 68 })
      + quarterTable([[20,"Q1",18],[22,"Q2",16],[20,"Q3",20],[13,"Q4",14]]);

    const result = scrapeGame(html, BASE_URL);
    expect(result.game.quarterScores[3]).toMatchObject({ quarter: "Q4", home: 13, away: 14 });
  });

  it("accepts OT games where quarter sum is less than final score", () => {
    // Regulation quarters sum to 80-80; final score is 90-85 (OT points not in array)
    const html = gameHeader({ homeScore: 90, awayScore: 85 })
      + quarterTable([[20,"Q1",18],[22,"Q2",20],[20,"Q3",23],[18,"Q4",19]]);

    const result = scrapeGame(html, BASE_URL);
    expect(result.game.quarterScores).toHaveLength(4);
    expect(result.game.finalScore).toMatchObject({ home: 90, away: 85 });
  });
});

describe("scrapeGame -- loadDoc injection", () => {
  it("injects quarter table payload from loadDoc call into the target div", () => {
    // The real sportstats page delivers quarter tables via loadDoc() JS calls
    // that the scraper resolves before parsing with cheerio.
    const tableHtml = PER_QUARTER_TABLE.replace(/"/g, '\\"');
    const html = `
      ${gameHeader({ homeScore: 39, awayScore: 45 })}
      <script>loadDoc("${tableHtml}", "scores1")</script>
      <div id="scores1"></div>
    `;

    const result = scrapeGame(html, BASE_URL);
    expect(result.game.quarterScores).toHaveLength(4);
    expect(result.game.quarterScores[0]).toMatchObject({ quarter: "Q1", home: 8, away: 5 });
  });

  it("resolves multiple loadDoc calls (per-quarter + cumulative both injected)", () => {
    const perQ    = PER_QUARTER_TABLE.replace(/"/g, '\\"');
    const cumul   = CUMULATIVE_TABLE.replace(/"/g, '\\"');
    const html = `
      ${gameHeader({ homeScore: 39, awayScore: 45 })}
      <script>loadDoc("${perQ}",  "scores1")</script>
      <div id="scores1"></div>
      <script>loadDoc("${cumul}", "scores2")</script>
      <div id="scores2"></div>
    `;

    const result = scrapeGame(html, BASE_URL);
    // Must still pick per-quarter
    expect(result.game.quarterScores[3]).toMatchObject({ home: 14, away: 9 });
  });
});

describe("scrapeGame -- player box score", () => {
  it("parses a player row into expected fields", () => {
    const row = playerRow(7, "ΑΡΜΑΝΙ Κ", "26:00", 12, {
      reb: 5, oreb: 1, dreb: 4, ast: 3, stl: 2, blk: 0, to: 1, pf: 2,
      fg2m: 4, fg2a: 6, fg3m: 1, fg3a: 3, ftm: 1, fta: 2, starter: true,
    });
    const totals = `<td>12</td><td>5</td><td>1</td><td>4</td>
      <td>3</td><td>2</td><td>0</td><td>1</td><td>2</td>
      <td><span class="bold">4 / 6</span></td>
      <td><span class="bold">1 / 3</span></td>
      <td><span class="bold">1 / 2</span></td>
      <td><span class="bold">5 / 9</span></td>`;
    const html = gameHeader()
      + playerSection("ARMANI KATEHANO", row, totals);

    const result = scrapeGame(html, BASE_URL);
    expect(result.teams).toHaveLength(1);

    const team = result.teams[0];
    expect(team.name).toBe("ARMANI KATEHANO");
    expect(team.players).toHaveLength(1);

    const p = team.players[0];
    expect(p["#"]).toBe(7);
    expect(p.MIN).toBe("26:00");
    expect(p.PTS).toBe(12);
    expect(p.REB).toBe(5);
    expect(p.AST).toBe(3);
    expect(p["2PTS"]).toMatchObject({ made: 4, attempted: 6 });
    expect(p["3PTS"]).toMatchObject({ made: 1, attempted: 3 });
    expect(p.FT).toMatchObject({ made: 1, attempted: 2 });
    expect(p.ST).toBe("Starter");
  });

  it("marks bench players correctly", () => {
    const row = playerRow(11, "BENCH PLAYER", "15:00", 6, { starter: false });
    const html = gameHeader() + playerSection("ARMANI KATEHANO", row, "<td>6</td>");
    const result = scrapeGame(html, BASE_URL);
    expect(result.teams[0].players[0].ST).toBe("Bench");
  });

  it("returns empty teams array when no .originalstats section exists", () => {
    const html = gameHeader();
    const result = scrapeGame(html, BASE_URL);
    expect(result.teams).toHaveLength(0);
  });

  it("parses two teams independently", () => {
    const rowAk  = playerRow(7, "ΑΡΜΑΝΙ", "26:00", 10);
    const rowOpp = playerRow(5, "ΑΝΤΙΠΑΛΟΣ", "28:00", 14);
    const totals = "<td>10</td>";
    const html = gameHeader()
      + playerSection("ARMANI KATEHANO", rowAk, totals)
      + playerSection("ΑΡΗΣ", rowOpp, totals);

    const result = scrapeGame(html, BASE_URL);
    expect(result.teams).toHaveLength(2);
    expect(result.teams[0].name).toBe("ARMANI KATEHANO");
    expect(result.teams[1].name).toBe("ΑΡΗΣ");
  });
});

describe("scrapeGame -- PDF fields isolation", () => {
  it("returns no offRating or defRating without PDF data (scrape-game.ts adds them later)", () => {
    // boxscore.ts must not produce offRating/defRating itself.
    // Those fields are added by scrape-game.ts after PDF parsing.
    const html = gameHeader() + PER_QUARTER_TABLE;
    const result = scrapeGame(html, BASE_URL);
    expect(result.game.offRating).toBeUndefined();
    expect(result.game.defRating).toBeUndefined();
  });

  it("result object has no unexpected top-level keys on game", () => {
    const html = gameHeader() + PER_QUARTER_TABLE;
    const result = scrapeGame(html, BASE_URL);
    const allowed = new Set([
      "homeTeam", "awayTeam", "finalScore", "quarterScores",
      "date", "time", "venue", "pdfUrl",
    ]);
    const actual = Object.keys(result.game);
    const unexpected = actual.filter(k => !allowed.has(k));
    expect(unexpected).toEqual([]);
  });
});
