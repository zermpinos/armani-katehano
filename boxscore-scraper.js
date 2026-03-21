#!/usr/bin/env node
/**
 * ============================================================
 * boxscore-scraper.js (ES Module version)
 * Scrapes player box score data from basketcity.sportstats.gr
 * ============================================================
 *
 * USAGE:
 *   node boxscore-scraper.js <game-url> [options]
 *
 * OPTIONS:
 *   --output <file>   Write JSON output to a file (default: stdout)
 *   --pretty          Pretty-print JSON output (default: compact)
 *   --csv             Output as CSV instead of JSON
 *   --help            Show this help message
 *
 * DEPENDENCIES:
 *   npm install cheerio
 *   Node.js 18+ has built-in fetch
 * ============================================================
 */

import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const cheerio = require('cheerio');

// Node 18+ has fetch; fallback to node-fetch if needed
let fetchFn;
try {
  fetchFn = globalThis.fetch ?? (await import('node-fetch')).default;
} catch {
  console.error('[ERROR] fetch is not available. Node 18+ has built-in fetch. Otherwise run: npm install node-fetch');
  process.exit(1);
}

// ---------------------------------------------------------------------------
// CLI argument parsing
// ---------------------------------------------------------------------------
function parseArgs(argv) {
  const args = argv.slice(2);
  const opts = { url: null, output: null, pretty: false, csv: false, help: false };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--help': opts.help = true; break;
      case '--pretty': opts.pretty = true; break;
      case '--csv': opts.csv = true; break;
      case '--output': opts.output = args[++i]; break;
      default:
        if (!args[i].startsWith('--')) opts.url = args[i];
    }
  }
  return opts;
}

function printHelp() {
  console.log(`
Usage: node boxscore-scraper.js <game-url> [options]

Options:
  --output <file>   Write output to a file
  --pretty          Pretty-print JSON
  --csv             Output as CSV (all players from both teams)
  --help            Show this help

Example:
  node boxscore-scraper.js "https://basketcity.sportstats.gr/men/gamedetails/id/XXXX"
  node boxscore-scraper.js "https://..." --pretty --output result.json
`);
}

// ---------------------------------------------------------------------------
// Core parsing helpers
// ---------------------------------------------------------------------------
function parseShotStat($cell) {
  const boldText = $cell.find('span.bold').text().trim();
  const full = $cell.text().trim();
  const madeParts = boldText.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!madeParts) return null;

  const made = parseInt(madeParts[1], 10);
  const attempted = parseInt(madeParts[2], 10);

  const pctMatch = full.replace(boldText, '').trim().match(/^([\d.]+)%?$/);
  const pct = pctMatch ? parseFloat(pctMatch[1]) : (attempted > 0 ? parseFloat(((made / attempted) * 100).toFixed(1)) : 0);

  return { made, attempted, pct };
}

function parseNum(text) {
  text = (text || '').trim();
  if (text === '') return null;
  const n = parseFloat(text);
  return isNaN(n) ? text : n;
}

function clean(text) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// Main scraper
// ---------------------------------------------------------------------------
function scrapeGame(html, url) {
  const $ = cheerio.load(html);
  const baseOrigin = new URL(url).origin;
  const result = { url, game: {}, teams: [] };

  // Game header
  const nameDivs = $('.name');
  result.game.homeTeam = clean(nameDivs.eq(0).text());
  result.game.awayTeam = clean(nameDivs.eq(1).text());

  // Date / time / venue
  const eventRaw = clean($('.event_info').text());
  const timeMatch = eventRaw.match(/(\d{1,2}:\d{2})/);
  const venueMatch = eventRaw.match(/Γήπεδο:\s*(.+)/);
  result.game.date = eventRaw.split(timeMatch?.[1] ?? '')[0].trim() || eventRaw;
  result.game.time = timeMatch ? timeMatch[1] : null;
  result.game.venue = venueMatch ? venueMatch[1].trim() : null;

  // Quarter + final scores
  let bestQ4Home = null, bestQ4Away = null;
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    if (rows.length !== 4) return;
    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const ok = rows.every((row, i) => {
      const cells = $(row).find('td');
      return cells.length === 3 && clean(cells.eq(1).text()) === labels[i];
    });
    if (!ok) return;

    const parsed = rows.map(row => {
      const cells = $(row).find('td');
      return {
        quarter: clean(cells.eq(1).text()),
        home: parseNum(cells.eq(0).text()),
        away: parseNum(cells.eq(2).text())
      };
    });

    const q4home = parsed[3].home;
    if (bestQ4Home === null || q4home > bestQ4Home) {
      bestQ4Home = parsed[3].home;
      bestQ4Away = parsed[3].away;
      result.game.quarterScores = parsed;
    }
  });
  result.game.finalScore = { home: bestQ4Home, away: bestQ4Away };

  // Box Score tables
  const SHOT_COLS = ['FT', '2PTS', '3PTS', 'FG'];
  $('.originalstats .statistics_boxscore').each((_, section) => {
    const $section = $(section);
    const teamName = clean($section.children('div').first().text());

    const table = $section.find('table.statsfull.comparative').first();
    if (!table.length) return;

    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;

    const headers = $(rows[0]).find('th').toArray().map(th => clean($(th).text())).filter(h => h);

    const players = [];
    let totals = null;
    let coaches = { coach: null, assistants: null };

    const altPs = $section.find('.alt p.title');
    coaches.coach = clean(altPs.eq(0).text()).replace(/^Coach\s*/i, '') || null;
    coaches.assistants = clean(altPs.eq(1).text()).replace(/^Assistants?\s*/i, '') || null;

    for (let i = 1; i < rows.length; i++) {
      const $row = $(rows[i]);
      const cells = $row.find('td').toArray();
      if (!cells.length) continue;

      const col0 = clean($(cells[0]).text());

      if (col0 === 'TOTALS') {
        totals = {};
        headers.forEach((h, idx) => {
          if (!h || !cells[idx]) return;
          const $c = $(cells[idx]);
          totals[h] = SHOT_COLS.includes(h) ? parseShotStat($c) : (parseNum($c.text()) ?? clean($c.text()));
        });
        continue;
      }

      if (col0 === 'Team/Coaches') continue;
      if (!/^\d+$/.test(col0)) continue;

      const player = {};
      headers.forEach((h, idx) => {
        if (!h || !cells[idx]) return;
        const $c = $(cells[idx]);
        const text = clean($c.text());

        if (SHOT_COLS.includes(h)) {
          player[h] = parseShotStat($c);
        } else if (h === '#') {
          player[h] = parseInt(text, 10);
        } else if (h === 'Players') {
          player[h] = text;
          const href = $c.find('a').attr('href');
          if (href) player.profile_url = href.startsWith('http') ? href : baseOrigin + href;
        } else if (h === 'ST') {
          player[h] = text === '*' ? 'Starter' : 'Bench';
        } else if (h === 'MIN') {
          player[h] = text;
        } else {
          player[h] = parseNum(text) ?? text;
        }
      });

      if (player['Players']) players.push(player);
    }

    result.teams.push({ name: teamName, coaches, players, totals });
  });

  return result;
}

// ---------------------------------------------------------------------------
// CSV formatter
// ---------------------------------------------------------------------------
function toCSV(data) {
  const cols = [
    'team', '#', 'name', 'status', 'MIN', 'PTS',
    'FT_made', 'FT_att', 'FT_pct',
    '2PT_made', '2PT_att', '2PT_pct',
    '3PT_made', '3PT_att', '3PT_pct',
    'FG_made', 'FG_att', 'FG_pct',
    'OREB', 'DREB', 'REB', 'AST', 'STL', 'BLK', 'TO', 'PF', 'FO', 'EF'
  ];

  const esc = v => (typeof v === 'string' && (v.includes(',') || v.includes('"') || v.includes('\n')))
    ? `"${v.replace(/"/g, '""')}"`
    : (v ?? '');

  const lines = [cols.join(',')];
  data.teams.forEach(team => {
    team.players.forEach(p => {
      lines.push([
        esc(team.name), p['#'], esc(p['Players']), esc(p['ST']), esc(p['MIN']), p['PTS'] ?? '',
        p['FT']?.made ?? '', p['FT']?.attempted ?? '', p['FT']?.pct ?? '',
        p['2PTS']?.made ?? '', p['2PTS']?.attempted ?? '', p['2PTS']?.pct ?? '',
        p['3PTS']?.made ?? '', p['3PTS']?.attempted ?? '', p['3PTS']?.pct ?? '',
        p['FG']?.made ?? '', p['FG']?.attempted ?? '', p['FG']?.pct ?? '',
        p['OREB'] ?? '', p['DREB'] ?? '', p['REB'] ?? '',
        p['AST'] ?? '', p['STL'] ?? '', p['BLK'] ?? '',
        p['TO'] ?? '', p['PF'] ?? '', p['FO'] ?? '', p['EF'] ?? ''
      ].join(','));
    });
  });

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------
async function main() {
  const opts = parseArgs(process.argv);

  if (opts.help || !opts.url) {
    printHelp();
    process.exit(opts.help ? 0 : 1);
  }

  let parsedUrl;
  try { parsedUrl = new URL(opts.url); } catch {
    console.error('[ERROR] Invalid URL:', opts.url);
    process.exit(1);
  }

  console.error('[INFO] Fetching:', parsedUrl.href);

  let html;
  try {
    const response = await fetchFn(parsedUrl.href, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; BoxScoreScraper/1.0)',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'el,en;q=0.9'
      }
    });
    if (!response.ok) {
      console.error(`[ERROR] HTTP ${response.status}: ${response.statusText}`);
      process.exit(1);
    }
    html = await response.text();
  } catch (err) {
    console.error('[ERROR] Fetch failed:', err.message);
    process.exit(1);
  }

  console.error('[INFO] Parsing box score...');
  const data = scrapeGame(html, parsedUrl.href);

  if (!data.teams.length) {
    console.error('[WARN] No box score data found. Make sure the URL points to a game details page.');
  } else {
    const total = data.teams.reduce((s, t) => s + t.players.length, 0);
    console.error(`[INFO] Found ${data.teams.length} teams, ${total} players`);
    data.teams.forEach(t => console.error(`       - ${t.name}: ${t.players.length} players`));
  }

  const output = opts.csv ? toCSV(data) : (opts.pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data));

  if (opts.output) {
    fs.writeFileSync(opts.output, output, 'utf8');
    console.error(`[INFO] Output written to: ${opts.output}`);
  } else {
    process.stdout.write(output + '\n');
  }
}

main().catch(err => {
  console.error('[FATAL]', err.message);
  process.exit(1);
});
