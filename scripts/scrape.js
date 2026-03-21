#!/usr/bin/env node
/**
 * scripts/scrape.js
 * Local CLI scraper for basketcity.sportstats.gr game pages.
 *
 * Usage:   node scripts/scrape.js <game-url>
 * Setup:   npm install playwright && npx playwright install chromium --with-deps
 * Config:  add to .env.local → IMPORT_SECRET=... and APP_URL=https://your-app.vercel.app
 */

import { chromium }  from "playwright";
import * as readline from "readline";
import * as fs       from "fs";
import * as path     from "path";
import * as url      from "url";

// ── Load .env.local ───────────────────────────────────────────────────────────
const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const envPath   = path.resolve(__dirname, "../.env.local");
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, "utf8").split("\n").forEach(line => {
    const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  });
}

const IMPORT_SECRET = process.env.IMPORT_SECRET;
const APP_URL       = (process.env.APP_URL || "").replace(/\/$/, "");
const ALLOWED_HOST  = "basketcity.sportstats.gr";

// ── Helpers ───────────────────────────────────────────────────────────────────
const ask = (question) => new Promise(resolve => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  rl.question(question, answer => { rl.close(); resolve(answer.trim().toLowerCase()); });
});

// ── Scrape ────────────────────────────────────────────────────────────────────
async function scrape(targetUrl) {
  console.log(`\n  Launching browser…`);

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    locale:    "el-GR",
    userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
  });
  const page = await context.newPage();

  await page.route("**/*.{png,jpg,jpeg,webp,gif,svg,woff,woff2,ttf,mp4,mp3}", r => r.abort());

  console.log(`  Fetching ${targetUrl}`);
  await page.goto(targetUrl, { waitUntil: "networkidle", timeout: 30_000 });
  await page.waitForTimeout(1500);

  const result = await page.evaluate(() => {

    // ── Helpers ───────────────────────────────────────────────────────────────
    const safeInt   = t => { const n = parseInt((t || "").trim(), 10); return isNaN(n) ? 0 : n; };
    const parseTime = t => {
      const m = (t || "").match(/^(\d+):(\d{2})$/);
      if (!m) return { display: "0:00", total_seconds: 0 };
      return { display: t.trim(), total_seconds: parseInt(m[1]) * 60 + parseInt(m[2]) };
    };
    const cellText = td => td ? td.innerText.trim() : "";

    // Parse fraction from a TD element — strips the % span by using innerHTML
    // so "1 / 3  33." becomes "1 / 3" correctly
    const parseFraction = td => {
      if (!td) return { made: 0, attempted: 0 };
      // Replace all HTML tags with spaces, then find the fraction
      const text = (td.innerHTML || "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      const m = text.match(/(\d+)\s*\/\s*(\d+)/);
      if (!m) return { made: 0, attempted: 0 };
      return { made: parseInt(m[1], 10), attempted: parseInt(m[2], 10) };
    };

    // ── Find box score tables ─────────────────────────────────────────────────
    const isBoxTable = t => {
      const h = (t.querySelector("thead, tr")?.innerText || "").toUpperCase();
      return (
        h.includes("ΟΝΟΜΑ") || h.includes("ΔΙΠ")  || h.includes("ΤΡΙΠ") ||
        h.includes("2PTS")  || h.includes("3PTS")  ||
        (h.includes("DREB") && h.includes("OREB"))
      );
    };

    const allBoxTables = [...document.querySelectorAll("table")].filter(isBoxTable);

    // Find ARMANI table by walking backwards to find nearest heading
    let akTable = null;
    for (const table of allBoxTables) {
      let node = table.previousElementSibling || table.parentElement?.previousElementSibling;
      for (let i = 0; i < 12; i++) {
        if (!node) break;
        const t = (node.innerText || "").toUpperCase();
        if (t.includes("ARMANI") || t.includes("KATEHANO")) { akTable = table; break; }
        node = node.previousElementSibling;
      }
      if (akTable) break;
    }
    if (!akTable && allBoxTables.length > 0) akTable = allBoxTables[0];
    if (!akTable) return { error: "Box score table not found" };

    // ── Column map ────────────────────────────────────────────────────────────
    const headerRow   = akTable.querySelector("thead tr, tr:first-child");
    const headerCells = headerRow ? [...headerRow.querySelectorAll("th, td")] : [];
    const colMap      = {};

    headerCells.forEach((th, i) => {
      const t = th.innerText.trim().toUpperCase().replace(/[\s.]/g, "");
      if      (t === "#" || t === "NO" || t === "Ν")                          colMap.jersey = i;
      else if (t.includes("ΟΝΟΜΑ") || t === "PLAYERS" || t === "PLAYER")     colMap.name   = i;
      else if (t === "ΠΟ"  || t === "PTS"  || t === "POINTS")                colMap.pts    = i;
      else if (t === "ΒΟΛ" || t === "FT")                                     colMap.ft     = i;
      else if (t === "ΔΙΠ" || t === "2PT"  || t === "2PTS")                  colMap.dp     = i;
      else if (t === "ΤΡΙΠ"|| t === "3PT"  || t === "3PTS")                  colMap.tp     = i;
      else if (t === "ΦΑ"  || t === "PF"   || t === "PFFO")                  colMap.pf     = i;
      else if (t === "ΚΦ"  || t === "TF")                                     colMap.tf     = i;
      else if (t === "ΡΑ"  || t === "DRB"  || t === "DREB")                  colMap.drb    = i;
      else if (t === "ΡΕ"  || t === "ORB"  || t === "OREB")                  colMap.orb    = i;
      else if (t === "ΡΙΜ" || t === "REB")                                    colMap.reb    = i;
      else if (t === "ΠΑΣ" || t === "AST")                                    colMap.ast    = i;
      else if (t === "ΚΛ"  || t === "STL")                                    colMap.stl    = i;
      else if (t === "ΚΟ"  || t === "BLK")                                    colMap.blk    = i;
      else if (t === "ΛΑ"  || t === "TOV"  || t === "TO")                    colMap.tov    = i;
      else if (t === "RAN" || t === "EFF"  || t === "EF")                     colMap.eff    = i;
      else if (t === "ΧΡ"  || t === "MIN")                                    colMap.min    = i;
    });

    const getCell = (cells, key, fallback) => cells[colMap[key] ?? fallback] ?? null;
    const getText = (cells, key, fallback) => cellText(getCell(cells, key, fallback));

    // ── Skip totals rows ──────────────────────────────────────────────────────
    const shouldSkip = tr => {
      const first = (tr.querySelector("td")?.innerText || "").trim();
      return (
        tr.classList.contains("totals") ||
        first.includes("Αιφν") || first.includes("Ομαδ") ||
        first.toLowerCase().includes("total") || first.toLowerCase().includes("σύνολ")
      );
    };

    // ── Parse player rows ─────────────────────────────────────────────────────
    const players = [...akTable.querySelectorAll("tbody tr, tr:not(:first-child)")]
      .filter(tr => !shouldSkip(tr))
      .map(tr => {
        const cells = [...tr.querySelectorAll("td")];
        if (cells.length < 5) return null;

        const jerseyStr = getText(cells, "jersey", 0);
        const jersey    = parseInt(jerseyStr, 10);
        const mins      = parseTime(getText(cells, "min", 3));

        // Pass cell ELEMENTS to parseFraction so it can strip % spans via innerHTML
        const ftCell = getCell(cells, "ft",  5);
        const dpCell = getCell(cells, "dp",  6);
        const tpCell = getCell(cells, "tp",  7);
        const ft     = parseFraction(ftCell);
        const dp     = parseFraction(dpCell);
        const tp     = parseFraction(tpCell);

        const drb = safeInt(getText(cells, "drb", 10));
        const orb = safeInt(getText(cells, "orb",  9));
        const reb = safeInt(getText(cells, "reb", 11));

        return {
          jersey_number:      isNaN(jersey) ? 0 : jersey,
          name_greek:         getText(cells, "name", 1),
          points:             safeInt(getText(cells, "pts", 4)),
          free_throws:        ft,
          two_point_fg:       dp,
          three_point_fg:     tp,
          fouls_committed:    safeInt(getText(cells, "pf", 16)),
          fouls_earned:       safeInt(getText(cells, "tf", 17)),
          defensive_rebounds: drb,
          offensive_rebounds: orb,
          total_rebounds:     reb || (drb + orb),
          assists:            safeInt(getText(cells, "ast", 12)),
          steals:             safeInt(getText(cells, "stl", 13)),
          blocks:             safeInt(getText(cells, "blk", 14)),
          turnovers:          safeInt(getText(cells, "tov", 15)),
          efficiency:         safeInt(getText(cells, "eff", 17)),
          minutes_played:     mins,
          did_not_play:       mins.total_seconds === 0,
        };
      })
      .filter(p => p !== null && (p.jersey_number > 0 || p.name_greek.length > 1));

    // ── Extract match info ────────────────────────────────────────────────────
    const fullText  = document.body.innerText;
    const dateMatch = fullText.match(/(\d{2})\/(\d{2})\/(\d{4})/);
    const date      = dateMatch ? `${dateMatch[3]}-${dateMatch[2]}-${dateMatch[1]}` : "";
    const mdMatch   = fullText.match(/[Αα]γωνιστική[:\s]+(\d+)/);
    const matchday  = mdMatch ? parseInt(mdMatch[1], 10) : 0;

    // ── Score extraction ──────────────────────────────────────────────────────
    // The page shows scores as large standalone numbers separated by a dash or newlines.
    // Strategy: find the two team names near the top, then grab the scores next to them.
    let akScore = 0, oppScore = 0, oppTeamName = "", isHome = false;

    // Try to find score elements directly — sportstats renders them as large text
    // Look for elements containing just a 2-digit number near team name elements
    const allEls = [...document.querySelectorAll("*")];

    // Find the element that contains just "34" (our score) near the ARMANI heading
    // Look for a pattern: two score numbers separated by some content
    // The title is "ARMANI KATEHANO - ΦΟΝΙΚΕΣ ΤΡΟΜΠΕΤΕΣ / ..."
    const titleText = document.title || "";
    const titleMatch = titleText.match(/^(.+?)\s*[-\/]\s*(.+?)\s*\//);
    if (titleMatch) {
      const teamA = titleMatch[1].trim().toUpperCase();
      const teamB = titleMatch[2].trim();
      if (teamA.includes("ARMANI") || teamA.includes("KATEHANO")) {
        isHome = true;
        oppTeamName = teamB;
      } else {
        isHome = false;
        oppTeamName = teamA;
      }
    }

    // Find scores from the scoreboard area — look for elements with just digits
    // that are siblings/near the team name elements
    const scoreEls = allEls.filter(el =>
      el.children.length === 0 &&
      /^\d{1,3}$/.test((el.innerText || "").trim()) &&
      parseInt((el.innerText || "").trim(), 10) > 0
    );

    // The first two standalone score numbers near the top of the page are the scores
    const topScores = scoreEls
      .filter(el => {
        const rect = el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        return rect && rect.top < 400; // scores appear in the top portion of the page
      })
      .map(el => parseInt(el.innerText.trim(), 10))
      .filter(n => n > 0 && n < 200)
      .slice(0, 2);

    if (topScores.length === 2) {
      if (isHome) {
        akScore  = topScores[0];
        oppScore = topScores[1];
      } else {
        oppScore = topScores[0];
        akScore  = topScores[1];
      }
    }

    // Fallback: try "XX - YY" or "XX – YY" in page text
    if (akScore === 0 && oppScore === 0) {
      const lines = fullText.split("\n").map(l => l.trim()).filter(Boolean);
      for (let i = 0; i < lines.length; i++) {
        const dashMatch = lines[i].match(/^(\d+)\s*[-–]\s*(\d+)$/);
        if (dashMatch) {
          const before = (lines[i - 1] || "").toUpperCase();
          const after  = (lines[i + 1] || "").toUpperCase();
          if (before.includes("ARMANI") || before.includes("KATEHANO")) {
            akScore = parseInt(dashMatch[1]); oppScore = parseInt(dashMatch[2]);
            if (!oppTeamName) oppTeamName = lines[i + 1] || "";
            isHome = true;
          } else if (after.includes("ARMANI") || after.includes("KATEHANO")) {
            oppScore = parseInt(dashMatch[1]); akScore = parseInt(dashMatch[2]);
            if (!oppTeamName) oppTeamName = lines[i - 1] || "";
            isHome = false;
          }
          break;
        }
      }
    }

    // Clean up opponent name if it still has junk
    oppTeamName = oppTeamName.replace(/\s*\/.*$/, "").trim();

    const competition = document.querySelector("h1, .competition-title, .game-title")?.innerText?.trim()
      ?? document.title?.trim()
      ?? "";

    return {
      date, competition, matchday,
      akTeamName: "ARMANI KATEHANO", oppTeamName,
      akScore, oppScore, isHome,
      players, colMap,
    };
  });

  await browser.close();
  return result;
}

// ── Assemble output JSON ──────────────────────────────────────────────────────
function buildOutput(raw, sourceUrl) {
  const league = detectLeague(raw.competition, sourceUrl);
  const result = raw.akScore > raw.oppScore ? "W" : "L";

  const output = {
    match_info: {
      date:                  raw.date,
      home_team:             raw.isHome ? raw.akTeamName : raw.oppTeamName,
      away_team:             raw.isHome ? raw.oppTeamName : raw.akTeamName,
      home_score:            raw.isHome ? raw.akScore    : raw.oppScore,
      away_score:            raw.isHome ? raw.oppScore   : raw.akScore,
      competition:           raw.competition,
      matchday:              raw.matchday,
      league,
      result,
      opponent:              raw.oppTeamName,
      armani_katehano_score: raw.akScore,
      opponent_score:        raw.oppScore,
      source_url:            sourceUrl,
    },
    armani_katehano: { players: raw.players },
  };

  // Sanity checks
  const warnings = [];
  for (const p of raw.players) {
    if (p.did_not_play) continue;
    const expPts = (p.two_point_fg?.made ?? 0) * 2
                 + (p.three_point_fg?.made ?? 0) * 3
                 + (p.free_throws?.made ?? 0);
    if (p.points !== expPts)
      warnings.push(`#${p.jersey_number} ${p.name_greek}: pts=${p.points}, expected ${expPts}`);
    const expReb = (p.defensive_rebounds ?? 0) + (p.offensive_rebounds ?? 0);
    if (p.total_rebounds !== expReb)
      warnings.push(`#${p.jersey_number} ${p.name_greek}: reb=${p.total_rebounds}, DRB+ORB=${expReb}`);
    for (const [label, stat] of [["FT", p.free_throws], ["2PT", p.two_point_fg], ["3PT", p.three_point_fg]]) {
      if ((stat?.made ?? 0) > (stat?.attempted ?? 0))
        warnings.push(`#${p.jersey_number} ${p.name_greek}: ${label} made > attempted`);
    }
  }
  if (warnings.length) output._warnings = warnings;

  return output;
}

function detectLeague(competition = "", pageUrl = "") {
  const t = competition.toUpperCase();
  const u = pageUrl.toLowerCase();
  if (t.includes("ROOKIE") || t.includes("ΝΕΩΝ"))          return "rookie";
  if (t.includes("BC6")    || t.includes("Β' ΚΑΤΗΓΟΡΙΑ"))  return "bc6";
  if (t.includes("WINTER CUP") || t.includes("ΧΕΙΜΕΡΙΝΟ")) return "wintercup";
  if (u.includes("winter-cup"))  return "wintercup";
  if (u.includes("rookie"))      return "rookie";
  if (u.includes("bc6"))         return "bc6";
  return "";
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  const targetUrl = process.argv[2];

  if (!targetUrl) {
    console.error("\n  Usage: node scripts/scrape.js <sportstats-game-url>\n");
    process.exit(1);
  }

  let parsed;
  try { parsed = new URL(targetUrl); }
  catch { console.error("  Invalid URL."); process.exit(1); }

  if (parsed.hostname !== ALLOWED_HOST) {
    console.error(`  URL must be from ${ALLOWED_HOST}`);
    process.exit(1);
  }

  if (!IMPORT_SECRET || !APP_URL) {
    console.error("\n  Missing config. Add to .env.local:\n    IMPORT_SECRET=...\n    APP_URL=https://your-app.vercel.app\n");
    process.exit(1);
  }

  let raw;
  try {
    raw = await scrape(targetUrl);
  } catch (err) {
    console.error("\n  Scrape failed:", err.message);
    process.exit(1);
  }

  if (raw.error) {
    console.error("\n  Error:", raw.error);
    process.exit(1);
  }

  const output = buildOutput(raw, targetUrl);
  const mi     = output.match_info;
  const active = output.armani_katehano.players.filter(p => !p.did_not_play);

  console.log("\n  ─────────────────────────────────────────────");
  console.log(`  ${mi.result === "W" ? "✓ WIN" : "✗ LOSS"}  ${mi.armani_katehano_score}–${mi.opponent_score}  vs ${mi.opponent}`);
  console.log(`  Date: ${mi.date}   League: ${mi.league || "(unknown)"}   Matchday: ${mi.matchday}`);
  console.log(`  Players: ${active.length} active`);

  if (output._warnings?.length) {
    console.log("\n  ⚠ Warnings:");
    output._warnings.forEach(w => console.log(`    • ${w}`));
  }

  console.log("\n  Box score:");
  console.log("  #   Name                        PTS  REB  AST  2PM/A  3PM/A   FT");
  active.forEach(p => {
    const name = p.name_greek.padEnd(28, " ").slice(0, 28);
    const pts  = String(p.points).padStart(3);
    const reb  = String(p.total_rebounds).padStart(4);
    const ast  = String(p.assists).padStart(4);
    const dp   = `${p.two_point_fg.made}/${p.two_point_fg.attempted}`.padStart(6);
    const tp   = `${p.three_point_fg.made}/${p.three_point_fg.attempted}`.padStart(6);
    const ft   = `${p.free_throws.made}/${p.free_throws.attempted}`.padStart(5);
    console.log(`  #${String(p.jersey_number).padEnd(3)} ${name} ${pts} ${reb} ${ast} ${dp}  ${tp}  ${ft}`);
  });

  console.log("  ─────────────────────────────────────────────");

  const answer = await ask("\n  Save to database? (y/n): ");
  if (answer !== "y" && answer !== "yes") {
    console.log("  Cancelled.\n");
    process.exit(0);
  }

  console.log(`\n  Posting to ${APP_URL}/api/admin/import …`);

  try {
    const res = await fetch(`${APP_URL}/api/admin/import`, {
      method:  "POST",
      headers: { "Content-Type": "application/json" },
      body:    JSON.stringify({ secret: IMPORT_SECRET, data: output }),
    });

    const json = await res.json();

    if (!res.ok) {
      console.error(`\n  ✗ Failed (${res.status}): ${json.error}\n`);
      process.exit(1);
    }

    console.log(`\n  ✓ Saved! Game ID: ${json.gameId}`);
    console.log(`    Players imported: ${json.playersImported}`);
    if (json.skipped?.length)  console.log(`    Skipped (not in DB): ${json.skipped.join(", ")}`);
    if (json.warnings?.length) console.log(`    Warnings: ${json.warnings.length}`);
    console.log();

  } catch (err) {
    console.error("\n  Network error:", err.message);
    process.exit(1);
  }
}

main().catch(err => { console.error(err); process.exit(1); });