/**
 * lib/parser.js
 *
 * Parses Basket City basketball stat PDFs using spatial (coordinate-based)
 * text extraction via pdfjs-dist. Works entirely server-side — no external
 * API calls, no cost.
 *
 * Calibrated and tested against 18 real Armani Katehano game PDFs.
 */

import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

const ROSTER = {
   0: { name: "Alexandros Kougianos",      position: "PF/C"     },
   3: { name: "Stathis Christofilopoulos", position: "SG"       },
   5: { name: "Panagiotis Zermpinos",      position: "C"        },
   6: { name: "Nikos Tsiardakas",          position: "PG/SG"    },
   8: { name: "Spiros Papaspirou",         position: "PG"       },
   9: { name: "Dimitris Alevizos",         position: "SG"       },
  10: { name: "Loukas Margaritis",         position: "C"        },
  11: { name: "Giorgos Antonakos",         position: "PG"       },
  14: { name: "Giorgos Tsioulkas",         position: "SF/PF"    },
  19: { name: "Panagiotis Antonakos",      position: "PG/SG/SF" },
  23: { name: "Konstantinos Psillas",      position: "PG/SG"    },
  26: { name: "Tolis Michalopoulos",       position: "SG/SF"    },
  77: { name: "Andreas Papadimitriou",     position: "PG/SG"    },
};

function safeInt(s, fallback = 0) {
  const n = parseInt(String(s ?? "").replace(/[^-0-9]/g, ""), 10);
  return isNaN(n) ? fallback : n;
}

function parseFrac(s) {
  const m = String(s ?? "").replace(/\s/g, "").match(/^(-?\d+)\/(\d+)$/);
  if (!m) return { made: 0, attempted: 0 };
  return { made: safeInt(m[1]), attempted: safeInt(m[2]) };
}

function parseMinutes(s) {
  const clean = String(s ?? "").trim();
  if (!clean || clean === "00:00") return { display: "00:00", total_seconds: 0 };
  const parts = clean.split(":");
  const secs  = (parseInt(parts[0]) || 0) * 60 + (parseInt(parts[1]) || 0);
  return { display: clean, total_seconds: secs };
}

function clusterRows(items, tol = 4) {
  const rows = new Map();
  const keys = [];
  for (const item of items) {
    const y = item.y;
    let matched = null;
    for (const k of keys) {
      if (Math.abs(y - k) <= tol) { matched = k; break; }
    }
    if (matched === null) { keys.push(y); matched = y; }
    if (!rows.has(matched)) rows.set(matched, []);
    rows.get(matched).push({ x: item.x, text: item.text });
  }
  for (const row of rows.values()) row.sort((a, b) => a.x - b.x);
  return rows;
}

function getVal(row, xMin, xMax, fallback = "0") {
  const hit = row.find(i => i.x >= xMin && i.x <= xMax);
  return hit ? hit.text : fallback;
}

function getFrac(row, xMin, xMax) {
  const hit = row.find(i => i.x >= xMin && i.x <= xMax && i.text.includes("/"));
  return parseFrac(hit ? hit.text : "0/0");
}

function isPlayerRow(row) {
  const hasJersey  = row.some(i => i.x < 35 && /^\d+$/.test(i.text));
  const hasMinutes = row.some(i => i.x > 545 && /^\d{2}:\d{2}$/.test(i.text));
  return hasJersey && hasMinutes;
}

export async function parseBasketCityPDF(pdfData) {
  const loadingTask = pdfjsLib.getDocument({ data: pdfData, verbosity: 0 });
  const pdf = await loadingTask.promise;

  const allItems = [];
  for (let p = 1; p <= pdf.numPages; p++) {
    const page     = await pdf.getPage(p);
    const content  = await page.getTextContent();
    const viewport = page.getViewport({ scale: 1 });
    const h        = viewport.height;
    for (const item of content.items) {
      const text = item.str.trim();
      if (!text) continue;
      allItems.push({
        x: Math.round(item.transform[4]),
        y: Math.round(h - item.transform[5]),
        text,
      });
    }
  }

  const rows     = clusterRows(allItems);
  const sortedYs = [...rows.keys()].sort((a, b) => a - b);
  const fullText = allItems.map(i => i.text).join(" ");

  // ── Match metadata ────────────────────────────────────────────────────────
  const matchInfo = {};

  const dateM = fullText.match(/(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}:\d{2})/);
  if (dateM) { matchInfo.date = dateM[1]; matchInfo.tip_off = dateM[2]; }

  const periodM = fullText.match(/Περίοδος:\s*([\d\-]+),\s*(\d+ος Γύρος),\s*([^,]+),\s*(?:Ομιλος:\s*(\d+),\s*)?Αγωνιστική:\s*(\d+)/);
  if (periodM) {
    matchInfo.season      = periodM[1].trim();
    matchInfo.competition = periodM[3].trim();
    matchInfo.matchday    = parseInt(periodM[5]);
  }

  // Find score line "NN - NN" between the two team names
  // Strategy: find all rows that match /^\d+ - \d+$/ pattern
  for (const y of sortedYs) {
    const rowText = rows.get(y).map(i => i.text).join(" ").trim();
    const sm = rowText.match(/^(\d+)\s*-\s*(\d+)$/);
    if (!sm) continue;
    const s1 = parseInt(sm[1]), s2 = parseInt(sm[2]);

    // Find team names — they appear as rows above and below the score
    const above = sortedYs.filter(yy => yy < y && yy > y - 60);
    const below = sortedYs.filter(yy => yy > y && yy < y + 60);

    const aboveTexts = above.flatMap(yy => rows.get(yy).map(i => i.text));
    const belowTexts = below.flatMap(yy => rows.get(yy).map(i => i.text));
    const allNearby  = [...aboveTexts, ...belowTexts].join(" ");

    const akAbove = aboveTexts.some(t => t.includes("ARMANI") || t.includes("KATEHANO"));
    const akBelow = belowTexts.some(t => t.includes("ARMANI") || t.includes("KATEHANO"));

    if (akAbove) {
      // AK listed first = AK is home team with score s1
      const oppText = belowTexts.find(t => t.length > 3 && !t.match(/^\d/) && !t.includes("Period") && !t.includes("ARMANI"));
      matchInfo.opponent              = oppText ?? "OPPONENT";
      matchInfo.armani_katehano_score = s1;
      matchInfo.opponent_score        = s2;
    } else if (akBelow) {
      const oppText = aboveTexts.find(t => t.length > 3 && !t.match(/^\d/) && !t.includes("ARMANI"));
      matchInfo.opponent              = oppText ?? "OPPONENT";
      matchInfo.armani_katehano_score = s2;
      matchInfo.opponent_score        = s1;
    } else {
      // Fallback: assume AK is first score
      matchInfo.armani_katehano_score = s1;
      matchInfo.opponent_score        = s2;
    }

    matchInfo.result = matchInfo.armani_katehano_score > matchInfo.opponent_score ? "W" : "L";
    break;
  }

  // ── Find AK stat section ──────────────────────────────────────────────────
  const sectionHeaders = [];
  for (const y of sortedYs) {
    if (rows.get(y).some(i => i.text.includes("ΟΝΟΜΑ"))) sectionHeaders.push(y);
  }

  let akSectionStartY = null;
  let akSectionEndY   = null;

  for (const headerY of sectionHeaders) {
    const above = sortedYs.filter(yy => yy < headerY && yy > headerY - 50);
    const isAK  = above.some(yy =>
      rows.get(yy).some(i => i.text.includes("ARMANI") || i.text.includes("KATEHANO"))
    );
    if (isAK) {
      akSectionStartY = headerY;
      const nextHeader = sectionHeaders.find(h => h > headerY);
      akSectionEndY   = nextHeader ?? Infinity;
      break;
    }
  }

  if (akSectionStartY == null) {
    throw new Error("Could not locate ARMANI KATEHANO stat section in this PDF.");
  }

  // ── Parse player rows ─────────────────────────────────────────────────────
  const players = [];

  for (const y of sortedYs) {
    if (y <= akSectionStartY) continue;
    if (y >= akSectionEndY)   break;

    const row = rows.get(y);
    if (!isPlayerRow(row)) continue;

    const jersey = parseInt(getVal(row, 10, 35));
    if (!ROSTER[jersey]) continue;

    const pts  = safeInt(getVal(row, 145, 170));
    const bol  = getFrac(row, 170, 230);
    const dip  = getFrac(row, 230, 290);
    const trip = getFrac(row, 290, 345);

    const ra  = safeInt(getVal(row, 380, 405));
    const re  = safeInt(getVal(row, 405, 425));
    const rim = safeInt(getVal(row, 425, 445));
    const pas = safeInt(getVal(row, 445, 465));
    const kl  = safeInt(getVal(row, 465, 487));
    const ko  = safeInt(getVal(row, 487, 508));
    const la  = safeInt(getVal(row, 508, 530));
    const ran = safeInt(getVal(row, 530, 555));

    const minParsed = parseMinutes(getVal(row, 550, 580, "00:00"));

    players.push({
      jersey_number:      jersey,
      name:               ROSTER[jersey].name,
      position:           ROSTER[jersey].position,
      did_not_play:       minParsed.total_seconds === 0,
      minutes_played:     minParsed,
      points:             pts,
      free_throws:        { made: bol.made,  attempted: bol.attempted  },
      two_point_fg:       { made: dip.made,  attempted: dip.attempted  },
      three_point_fg:     { made: trip.made, attempted: trip.attempted },
      offensive_rebounds: ra,
      defensive_rebounds: re,
      total_rebounds:     rim,
      assists:            pas,
      steals:             kl,
      blocks:             ko,
      turnovers:          la,
      efficiency:         ran,
    });
  }

  players.sort((a, b) => a.jersey_number - b.jersey_number);

  if (players.length === 0) {
    throw new Error("No player stats found. Is this a valid Basket City stat sheet?");
  }

  return {
    match_info: {
      date:                   matchInfo.date ?? "",
      tip_off:                matchInfo.tip_off ?? "",
      competition:            matchInfo.competition ?? "",
      matchday:               matchInfo.matchday ?? null,
      season:                 matchInfo.season ?? "",
      opponent:               matchInfo.opponent ?? "",
      armani_katehano_score:  matchInfo.armani_katehano_score ?? 0,
      opponent_score:         matchInfo.opponent_score ?? 0,
      result:                 matchInfo.result ?? "L",
    },
    armani_katehano: { players },
  };
}
