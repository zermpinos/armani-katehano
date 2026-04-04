/**
 * pages/api/admin/scrape.js
 * POST /api/admin/scrape
 *
 * Accepts { url } and returns the scraped box score JSON.
 * The actual scraping runs server-side so the admin never has to run the CLI.
 * Protected by admin session cookie via requireAuth().
 */

import { z }             from 'zod';
import { requireAuth }   from '../../../lib/requireAuth.js';
import { scrapeGame }    from '../../../lib/boxscore-scraper.js';
import { securityHeaders } from '../../../lib/security.js';

const ScrapeSchema = z.object({
  url: z.string().url().max(500),
});

export default requireAuth(async function handler(req, res) {
  Object.entries(securityHeaders()).forEach(([k, v]) => res.setHeader(k, v));

  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid URL' });

  const { url } = parsed.data;

  let response;
  try {
    response = await fetch(url, {
      headers: {
        'User-Agent':      'Mozilla/5.0 (compatible; BoxScoreScraper/1.0)',
        'Accept':          'text/html,application/xhtml+xml',
        'Accept-Language': 'el,en;q=0.9',
      },
    });
  } catch (err) {
    return res.status(502).json({ error: `Fetch failed: ${err.message}` });
  }

  if (!response.ok)
    return res.status(502).json({ error: `Upstream HTTP ${response.status}: ${response.statusText}` });

  const html = await response.text();

  let data;
  try {
    data = scrapeGame(html, url);
  } catch (err) {
    return res.status(422).json({ error: `Parse error: ${err.message}` });
  }

  if (!data.teams.length)
    return res.status(422).json({ error: 'No box score found -- check the URL points to a game details page.' });

  return res.status(200).json({ ok: true, data });
});
