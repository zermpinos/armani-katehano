/**
 * pages/api/admin/scrape.js
 * POST /api/admin/scrape
 *
 * Accepts { url } and returns the scraped box score JSON.
 * The actual scraping runs server-side so the admin never has to run the CLI.
 * Protected by admin session cookie via requireAuth().
 */

import dns                               from 'dns';
import { requireAuth }                   from '@/server/auth';
import { scrapeGame }                    from '@/server/integrations/scraper/boxscore';
import { ScrapedGameSchema, ScrapeSchema } from '@/schemas';
import { prodError }                     from '@/domain/shared/format';

// ─── SSRF guard ───────────────────────────────────────────────────────────────

// SCRAPE_HOSTNAME_ALLOWLIST: comma-separated bare hostnames (no wildcards).
// Each entry matches that hostname and all subdomains.
// Default: the two known scraper targets.
const ALLOWLIST: string[] = (
  process.env.SCRAPE_HOSTNAME_ALLOWLIST ?? 'basketcity.sportstats.gr,basketaki.com'
)
  .split(',')
  .map(h => h.trim().toLowerCase())
  .filter(Boolean);

function isAllowedHostname(hostname: string): boolean {
  const h = hostname.toLowerCase();
  return ALLOWLIST.some(entry => h === entry || h.endsWith('.' + entry));
}

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

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid URL' });

  const { url } = parsed.data;

  // SSRF guard — three-layer defence:
  //   1. Allowlist: only basket.gr / *.basket.gr permitted
  //   2. Resolve once and check the IP (eliminates DNS rebinding TOCTOU)
  //   3. Redirect following disabled (prevents redirect-pivot to internal hosts)
  let urlObj: URL;
  try { urlObj = new URL(url); } catch {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:')
    return res.status(400).json({ error: 'URL not allowed' });

  if (!isAllowedHostname(urlObj.hostname))
    return res.status(400).json({ error: 'URL not allowed' });

  let address: string;
  try {
    ({ address } = await dns.promises.lookup(urlObj.hostname));
  } catch {
    return res.status(400).json({ error: 'URL not allowed' });
  }

  if (isPrivateIp(address))
    return res.status(400).json({ error: 'URL not allowed' });

  let response;
  try {
    response = await fetch(url, {
      redirect: 'manual',
      headers: {
        'User-Agent': 'BoxScoreScraper/1.0',
        'Accept':     'text/html,application/xhtml+xml',
      },
    });
  } catch (err) {
    return res.status(502).json({ error: prodError(err) });
  }

  if (response.status >= 300 && response.status < 400)
    return res.status(502).json({ error: 'Upstream redirected — refusing to follow.' });

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
      error: 'Scraped data has unexpected shape — the source site may have changed format.',
      detail: validation.error.flatten(),
    });
  }

  if (!data.teams.length)
    return res.status(422).json({ error: 'No box score found — check the URL points to a game details page.' });

  return res.status(200).json({ ok: true, data });
});
