/**
 * pages/api/admin/scrape.js
 * POST /api/admin/scrape
 *
 * Accepts { url } and returns the scraped box score JSON.
 * The actual scraping runs server-side so the admin never has to run the CLI.
 * Protected by admin session cookie via requireAuth().
 */

import dns                               from 'dns';
import { z }                              from 'zod';
import { requireAuth }                   from '../../../lib/requireAuth';
import { scrapeGame }                    from '../../../lib/boxscore-scraper';
import { ScrapedGameSchema }             from '../../../lib/validators';
import { prodError }                     from '../../../lib/utils';

// ─── SSRF guard ───────────────────────────────────────────────────────────────

function isPrivateIp(ip: string): boolean {
  // IPv4 private / reserved ranges
  if (
    /^127\./.test(ip)          ||  // loopback
    /^10\./.test(ip)           ||  // RFC 1918
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||  // RFC 1918
    /^192\.168\./.test(ip)     ||  // RFC 1918
    /^169\.254\./.test(ip)     ||  // link-local / cloud metadata (AWS, GCP, Azure)
    /^0\./.test(ip)            ||  // "this" network
    /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip) ||  // CGNAT
    /^198\.1[89]\./.test(ip)      // benchmarking
  ) return true;

  // IPv6 special ranges
  if (
    ip === '::1'               ||  // loopback
    /^::ffff:127\./i.test(ip)  ||  // IPv4-mapped loopback
    /^fe80:/i.test(ip)         ||  // link-local
    /^fc00:/i.test(ip)         ||  // unique local
    /^fd[0-9a-f]{2}:/i.test(ip)   // unique local
  ) return true;

  return false;
}

/**
 * Returns true only if the URL:
 *  - uses http: or https:
 *  - is not localhost / .localhost
 *  - resolves to no private/reserved IPs
 */
async function isSafeUrl(rawUrl: string): Promise<boolean> {
  let parsed: URL;
  try { parsed = new URL(rawUrl); } catch { return false; }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;

  const hostname = parsed.hostname;

  if (hostname === 'localhost' || hostname.endsWith('.localhost')) return false;

  // Check IP literal before DNS
  if (isPrivateIp(hostname)) return false;

  // Resolve hostname -> all A/AAAA records and verify every address
  const [v4, v6] = await Promise.all([
    dns.promises.resolve4(hostname).catch(() => [] as string[]),
    dns.promises.resolve6(hostname).catch(() => [] as string[]),
  ]);
  const addresses = [...v4, ...v6];

  // If the hostname didn't resolve at all, let fetch fail naturally (not an SSRF risk)
  if (addresses.length === 0) return true;

  return !addresses.some(isPrivateIp);
}

// ─── Schema ───────────────────────────────────────────────────────────────────

const ScrapeSchema = z.object({
  url: z.string().url().max(500),
});

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid URL' });

  const { url } = parsed.data;

  // SSRF guard: reject private / internal addresses
  const safe = await isSafeUrl(url);
  if (!safe)
    return res.status(400).json({ error: 'URL not allowed' });

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
    return res.status(502).json({ error: prodError(err) });
  }

  if (!response.ok)
    return res.status(502).json({ error: `Upstream returned ${response.status}` });

  const html = await response.text();

  let data: any;
  try {
    data = scrapeGame(html, url);
  } catch (err) {
    return res.status(422).json({ error: prodError(err) });
  }

  // Validate the scraped shape before sending it to the client.
  // This catches format changes in the source site early.
  const validation = ScrapedGameSchema.safeParse(data);
  if (!validation.success) {
    return res.status(422).json({
      error: 'Scraped data has unexpected shape -- the source site may have changed format.',
      detail: validation.error.flatten(),
    });
  }

  if (!data.teams.length)
    return res.status(422).json({ error: 'No box score found -- check the URL points to a game details page.' });

  return res.status(200).json({ ok: true, data });
});
