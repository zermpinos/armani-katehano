/**
 * lib/parser.js
 * Game text → structured JSON.
 * Identical logic to the Python script — runs server-side only.
 */

const ROSTER = {
  0:  { name: "Alexandros Kougianos",      position: "PF" },
  3:  { name: "Stathis Christofilopoulos", position: "SG" },
  5:  { name: "Webmaster",      position: "C"  },
  6:  { name: "Nikos Tsiardakas",          position: "PG" },
  8:  { name: "Spiros Papaspirou",         position: "PG" },
  9:  { name: "Dimitris Alevizos",         position: "SG" },
  10: { name: "Loukas Margaritis",         position: "C"  },
  11: { name: "Giorgos Antonakos",         position: "PG" },
  14: { name: "Giorgos Tsioulkas",         position: "SF" },
  19: { name: "Panagiotis Antonakos",      position: "PG" },
  23: { name: "Konstantinos Psillas",      position: "PG" },
  26: { name: "Tolis Michalopoulos",       position: "SG" },
  77: { name: "Andreas Papadimitriou",     position: "PG" },
};

function parseFraction(m, a) {
  const made = parseInt(m) || 0, att = parseInt(a) || 0;
  return { made, attempted: att, pct: att > 0 ? Math.round(made / att * 1000) / 10 : 0 };
}
function safeInt(v)   { const n = parseInt(String(v).replace(",", "")); return isNaN(n) ? 0 : n; }
function safeFloat(v) { const n = parseFloat(String(v).replace(",", ".")); return isNaN(n) ? 0 : n; }
function parseMinutes(s) {
  s = (s || "").trim();
  if (!s || s === "00:00") return { display: "00:00", total_seconds: 0 };
  const [mm, ss] = s.split(":");
  return { display: s, total_seconds: (parseInt(mm) || 0) * 60 + (parseInt(ss) || 0) };
}

export function parseGameText(fullText) {
  const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
  const matchInfo = {};

  const dateM = fullText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
  if (dateM) { matchInfo.date = dateM[1]; matchInfo.tip_off = dateM[2]; }

  const venueM = fullText.match(/Γήπεδο:\s*(.+?)\s+\d{2}\/\d{2}/);
  if (venueM) matchInfo.venue = venueM[1].trim();

  const periodM = fullText.match(/Περίοδος:\s*(.+?),\s*(\d+ος Γύρος),\s*(.+?),\s*(?:Ομιλος:\s*(\d+),\s*)?Αγωνιστική:\s*(\d+)/);
  if (periodM) {
    matchInfo.season      = periodM[1].trim();
    matchInfo.round       = periodM[2].trim();
    matchInfo.competition = periodM[3].trim();
    matchInfo.group       = periodM[4] ? periodM[4].trim() : null;
    matchInfo.matchday    = parseInt(periodM[5]);
  }

  for (let i = 0; i < lines.length; i++) {
    const sm = lines[i].match(/^(\d+)\s*-\s*(\d+)$/);
    if (sm) {
      const s1 = parseInt(sm[1]), s2 = parseInt(sm[2]);
      const nextLine = (lines[i + 1] || "").trim();
      const akHome = nextLine.startsWith("ARMANI KATEHANO");
      matchInfo.home_team  = akHome ? "ARMANI KATEHANO" : nextLine.replace("ARMANI KATEHANO", "").trim();
      matchInfo.away_team  = akHome ? nextLine.replace("ARMANI KATEHANO", "").trim() : "ARMANI KATEHANO";
      matchInfo.home_score = s1;
      matchInfo.away_score = s2;
      break;
    }
  }

  const akIsHome = matchInfo.home_team === "ARMANI KATEHANO";
  matchInfo.armani_katehano_score = akIsHome ? matchInfo.home_score : matchInfo.away_score;
  matchInfo.opponent_score        = akIsHome ? matchInfo.away_score : matchInfo.home_score;
  matchInfo.opponent              = akIsHome ? matchInfo.away_team  : matchInfo.home_team;
  matchInfo.result                = matchInfo.armani_katehano_score > matchInfo.opponent_score ? "W" : "L";

  matchInfo.quarter_scores = {};
  const qIdx = lines.findIndex(l => l.includes("1η") && l.includes("2η"));
  if (qIdx >= 0) {
    for (let j = qIdx + 1; j < Math.min(qIdx + 6, lines.length); j++) {
      const parts = lines[j].split(/\s+/);
      if (parts.length >= 5) {
        const scores = parts.slice(-4).map(Number);
        if (scores.every(n => !isNaN(n))) {
          const teamName = parts.slice(0, parts.length - 4).join(" ");
          matchInfo.quarter_scores[teamName] = { Q1: scores[0], Q2: scores[1], Q3: scores[2], Q4: scores[3] };
        }
      }
    }
  }

  const HEADER = "NO ΟΝΟΜΑ ΑΘΛΗΤΗ";
  const sections = [];
  lines.forEach((line, i) => {
    if (line.includes(HEADER) && i > 0) sections.push({ headerIdx: i, teamName: lines[i - 1] });
  });

  function parseSection(sIdx) {
    const start = sections[sIdx].headerIdx;
    const end   = sIdx + 1 < sections.length ? sections[sIdx + 1].headerIdx - 1 : lines.length;
    const block = lines.slice(start + 1, end);
    const players = [];
    let totalsLine = "", possLine = "";

    block.forEach(line => {
      if (line.includes("ΟΝΟΜΑ")) return;
      if (line.startsWith("Αιφνιδιασμο")) { totalsLine = line; return; }
      if (line.includes("Possessions") || line.includes("Efficiency")) { possLine += " " + line; return; }

      const pm = line.match(
        /^(\d+)\s+(.+?)\s+(-?\d+)\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(-?\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(-?\d+)\s+(\d{2}:\d{2})/
      );
      if (!pm) return;
      const jersey = parseInt(pm[1]);
      if (!ROSTER[jersey]) return;

      players.push({
        jersey_number:      jersey,
        name:               ROSTER[jersey].name,
        name_greek:         pm[2].trim(),
        position:           ROSTER[jersey].position,
        did_not_play:       pm[20] === "00:00",
        minutes_played:     parseMinutes(pm[20]),
        points:             safeInt(pm[3]),
        free_throws:        parseFraction(pm[4], pm[5]),
        two_point_fg:       parseFraction(pm[6], pm[7]),
        three_point_fg:     parseFraction(pm[8], pm[9]),
        fouls_made:         safeInt(pm[10]),
        fouls_earned:       safeInt(pm[11]),
        defensive_rebounds: safeInt(pm[12]),
        offensive_rebounds: safeInt(pm[13]),
        total_rebounds:     safeInt(pm[14]),
        assists:            safeInt(pm[15]),
        steals:             safeInt(pm[16]),
        blocks:             safeInt(pm[17]),
        turnovers:          safeInt(pm[18]),
        efficiency:         safeInt(pm[19]),
      });
    });

    players.sort((a, b) => a.jersey_number - b.jersey_number);

    const team_totals = {};
    const tm = totalsLine.match(
      /Αιφνιδιασμο.+?(\d+)\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(\d+)\s*\/\s*(\d+)\s+[\d,\.]*\s+(\d+)\s+\d*\s*(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(-?\d+)\s+(\d+)/
    );
    if (tm) {
      team_totals.total_points       = safeInt(tm[1]);
      team_totals.free_throws        = parseFraction(tm[2], tm[3]);
      team_totals.two_point_fg       = parseFraction(tm[4], tm[5]);
      team_totals.three_point_fg     = parseFraction(tm[6], tm[7]);
      team_totals.fouls_made         = safeInt(tm[8]);
      team_totals.defensive_rebounds = safeInt(tm[9]);
      team_totals.offensive_rebounds = safeInt(tm[10]);
      team_totals.total_rebounds     = safeInt(tm[11]);
      team_totals.assists            = safeInt(tm[12]);
      team_totals.steals             = safeInt(tm[13]);
      team_totals.blocks             = safeInt(tm[14]);
      team_totals.turnovers          = safeInt(tm[15]);
      team_totals.efficiency         = safeInt(tm[16]);
    }
    const pm2 = possLine.match(/Possessions:\s*(\d+)/);
    if (pm2) team_totals.possessions = safeInt(pm2[1]);
    const em = possLine.match(/Off\.\/Def\.\s*Efficiency:\s*([\d,\.]+)\s*\/\s*([\d,\.]+)/);
    if (em) {
      team_totals.offensive_efficiency = safeFloat(em[1]);
      team_totals.defensive_efficiency = safeFloat(em[2]);
    }

    return { team_name: sections[sIdx].teamName, players, team_totals };
  }

  const akIdx  = sections.findIndex(s => s.teamName.includes("ARMANI") || s.teamName.includes("KATEHANO"));
  const oppIdx = sections.findIndex((_, i) => i !== akIdx);

  if (akIdx === -1 || sections.length < 2) {
    throw new Error("Could not find ARMANI KATEHANO section in PDF.");
  }

  return {
    match_info:      matchInfo,
    armani_katehano: parseSection(akIdx),
    opponent:        oppIdx >= 0 ? parseSection(oppIdx) : null,
  };
}
