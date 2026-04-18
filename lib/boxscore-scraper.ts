/**
 * lib/boxscore-scraper.js
 * Core scraping logic extracted from the CLI tool.
 * Exports scrapeGame(html, url) -> structured game + player data.
 */

import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function escapeRegex(s: string) { return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

function parseShotStat($cell: any) {
  const boldText = $cell.find('span.bold').text().trim();
  const full     = $cell.text().trim();

  const madeParts = boldText.match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!madeParts) return null;

  const made      = parseInt(madeParts[1], 10);
  const attempted = parseInt(madeParts[2], 10);

  const pctMatch = full.replace(boldText, '').trim().match(/^([\d.]+)%?$/);
  const pct = pctMatch
    ? parseFloat(pctMatch[1])
    : (attempted > 0 ? parseFloat(((made / attempted) * 100).toFixed(1)) : 0);

  return { made, attempted, pct };
}

function parseNum(text: string) {
  text = (text || '').trim();
  if (text === '') return null;
  const n = parseFloat(text);
  return isNaN(n) ? text : n;
}

function clean(text: string) {
  return (text || '').replace(/\s+/g, ' ').trim();
}

// ---------------------------------------------------------------------------
// scrapeGame
// ---------------------------------------------------------------------------

/**
 * Scrape a single game page and return structured data.
 * @param {string} html  Raw HTML of the game details page
 * @param {string} url   Source URL (used for absolute profile links + origin)
 * @returns {object}     { url, game, teams }
 */
export function scrapeGame(html: string, url: string) {
  // The site injects table HTML via inline JS: loadDoc("<table...>", "statistics1")
  const loadDocRe = /loadDoc\("((?:[^"\\]|\\[\s\S])*)",\s*"([\w]+)"\)/g;
  let match;
  while ((match = loadDocRe.exec(html)) !== null) {
    const payload = match[1].replace(/\\"/g, '"').replace(/\\'/g, "'").replace(/\\\\/g, '\\');
    const divId   = match[2];
    // eslint-disable-next-line security/detect-non-literal-regexp
    const divPat = new RegExp(`(<div\\s+id="${escapeRegex(divId)}"\\s*>)(</div>)`);
    html = html.replace(divPat, `$1${payload}$2`);
  }

  const $ = cheerio.load(html);
  const baseOrigin = new URL(url).origin;

  const result: { url: string; game: Record<string, any>; teams: any[] } = { url, game: {}, teams: [] };

  // ── Game header ──────────────────────────────────────────────────────────
  const nameDivs = $('.name');
  result.game.homeTeam = clean(nameDivs.eq(0).text());
  result.game.awayTeam = clean(nameDivs.eq(1).text());

  result.game.date  = clean($('#gameDate').text())  || null;
  result.game.time  = clean($('#gameTime').text())  || null;
  const venueRaw    = clean($('#stadiumname').text());
  result.game.venue = venueRaw.replace(/^Γήπεδο:\s*/i, '') || null;

  result.game.finalScore = {
    home: parseNum($('#gameScoreHome').text()),
    away: parseNum($('#gameScoreVisitor').text()),
  };

  // Quarter scores
  $('table').each((_, table) => {
    const rows = $(table).find('tr').toArray();
    if (rows.length !== 4) return;
    const labels = ['Q1', 'Q2', 'Q3', 'Q4'];
    const ok = rows.every((row, i) => {
      const cells = $(row).find('td');
      // eslint-disable-next-line security/detect-object-injection
      return cells.length === 3 && clean(cells.eq(1).text()) === labels[i];
    });
    if (!ok) return;

    const parsed = rows.map(row => {
      const cells = $(row).find('td');
      return {
        quarter: clean(cells.eq(1).text()),
        home:    parseNum(cells.eq(0).text()),
        away:    parseNum(cells.eq(2).text()),
      };
    });

    const q4home = parsed[3].home as number;
    if (!result.game.quarterScores || q4home > result.game.quarterScores[3].home) {
      result.game.quarterScores = parsed;
    }
  });

  if (result.game.finalScore.home === null && result.game.quarterScores) {
    result.game.finalScore.home = result.game.quarterScores[3].home;
    result.game.finalScore.away = result.game.quarterScores[3].away;
  }

  // ── Box Score tables ─────────────────────────────────────────────────────
  const SHOT_COLS = ['FT', '2PTS', '3PTS', 'FG'];

  $('.originalstats .statistics_boxscore').each((_, section) => {
    const $section = $(section);
    const teamName = clean($section.children('div').first().text());

    const table = $section.find('table.statsfull.comparative').first();
    if (!table.length) return;

    const rows = table.find('tr').toArray();
    if (rows.length < 2) return;

    const headers = $(rows[0]).find('th').toArray()
      .map(th => clean($(th).text()))
      .filter(h => h);

    const players: any[] = [];
    let totals: Record<string, any> | null = null;
    const coaches: { coach: string | null; assistants: string | null } = { coach: null, assistants: null };

    const altPs = $section.find('.alt p.title');
    coaches.coach      = clean(altPs.eq(0).text()).replace(/^Coach\s*/i, '')       || null;
    coaches.assistants = clean(altPs.eq(1).text()).replace(/^Assistants?\s*/i, '') || null;

    for (let i = 1; i < rows.length; i++) {
      // eslint-disable-next-line security/detect-object-injection
      const $row  = $(rows[i]);
      const cells = $row.find('td').toArray();
      if (!cells.length) continue;

      const col0 = clean($(cells[0]).text());

      if (col0 === 'TOTALS') {
        totals = {};
        headers.forEach((h, idx) => {
          // eslint-disable-next-line security/detect-object-injection
          if (!h || !cells[idx]) return;
          // eslint-disable-next-line security/detect-object-injection
          const $c = $(cells[idx]);
          // eslint-disable-next-line security/detect-object-injection
          (totals as Record<string, any>)[h] = SHOT_COLS.includes(h)
            ? parseShotStat($c)
            : (parseNum($c.text()) ?? clean($c.text()));
        });
        continue;
      }

      if (col0 === 'Team/Coaches') continue;
      if (!/^\d+$/.test(col0)) continue;

      const player: Record<string, any> = {};
      headers.forEach((h, idx) => {
        // eslint-disable-next-line security/detect-object-injection
        if (!h || !cells[idx]) return;
        // eslint-disable-next-line security/detect-object-injection
        const $c   = $(cells[idx]);
        const text = clean($c.text());

        if (SHOT_COLS.includes(h)) {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = parseShotStat($c);
        } else if (h === '#') {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = parseInt(text, 10);
        } else if (h === 'Players') {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = text;
          const href = $c.find('a').attr('href');
          if (href) player.profile_url = href.startsWith('http') ? href : baseOrigin + href;
        } else if (h === 'ST') {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = text === '*' ? 'Starter' : 'Bench';
        } else if (h === 'MIN') {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = text;
        } else {
          // eslint-disable-next-line security/detect-object-injection
          player[h] = parseNum(text) ?? text;
        }
      });

      if (player['Players']) players.push(player);
    }

    result.teams.push({ name: teamName, coaches, players, totals });
  });

  return result;
}
