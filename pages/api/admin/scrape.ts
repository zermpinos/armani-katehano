/**
 * pages/api/admin/scrape.js
 * POST /api/admin/scrape
 *
 * Accepts { url } and returns the scraped box score JSON.
 * The actual scraping runs server-side so the admin never has to run the CLI.
 * Protected by admin session cookie via requireAuth().
 */

import { PDFParse }                      from 'pdf-parse';
import { requireAuth }                   from '@/server/auth';
import { scrapeGame }                    from '@/server/integrations/scraper/boxscore';
import { ScrapedGameSchema, ScrapeSchema } from '@/schemas';
import { prodError }                     from '@/domain/shared/format';
import { assertSsrfSafe, isAllowedHostname, isPrivateIp } from '@/server/security/ssrf';
import dns from 'dns';

const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

function parsePdfEfficiency(text: string): { offRating: number | null; defRating: number | null } {
  const effRegex = /Off\.\/Def\. Efficiency:\s*([\d,]+)\s*\/\s*([\d,]+)/g;
  let m: RegExpExecArray | null;
  while ((m = effRegex.exec(text)) !== null) {
    const beforeMatch = text.slice(0, m.index);
    if (AK_IDENTIFIERS.some(id => beforeMatch.includes(id))) {
      return {
        offRating: parseFloat(m[1].replace(",", ".")),
        defRating: parseFloat(m[2].replace(",", ".")),
      };
    }
  }
  return { offRating: null, defRating: null };
}

export default requireAuth(async function handler(req: any, res: any) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Method not allowed' });

  const parsed = ScrapeSchema.safeParse(req.body ?? {});
  if (!parsed.success)
    return res.status(400).json({ error: 'Invalid URL' });

  const { url } = parsed.data;

  // SSRF guard -- three-layer defence:
  //   1. Allowlist: only known scraper hostnames permitted
  //   2. Resolve once and check the IP (eliminates DNS rebinding TOCTOU)
  //   3. Redirect following disabled (prevents redirect-pivot to internal hosts)
  try {
    await assertSsrfSafe(url);
  } catch {
    return res.status(400).json({ error: 'URL not allowed' });
  }

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
    return res.status(502).json({ error: 'Upstream redirected -- refusing to follow.' });

  if (!response.ok)
    return res.status(502).json({ error: `Upstream returned ${response.status}` });

  const html = await response.text();

  let data: any;
  try {
    data = scrapeGame(html, url);
  } catch (err) {
    return res.status(422).json({ error: prodError(err) });
  }

  // Fetch PDF and extract off/def efficiency ratings if a PDF URL was found.
  const pdfUrl = typeof data.game?.pdfUrl === 'string' ? data.game.pdfUrl : null;
  if (pdfUrl) {
    try {
      let pdfUrlObj: URL;
      try { pdfUrlObj = new URL(pdfUrl); } catch { throw new Error('Invalid PDF URL'); }

      if (!isAllowedHostname(pdfUrlObj.hostname)) throw new Error('PDF host not allowed');

      const { address: pdfAddress } = await dns.promises.lookup(pdfUrlObj.hostname);
      if (isPrivateIp(pdfAddress)) throw new Error('PDF host resolves to private IP');

      const pdfResponse = await fetch(pdfUrl, {
        redirect: 'manual',
        headers: { 'User-Agent': 'BoxScoreScraper/1.0' },
      });

      if (pdfResponse.ok) {
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const parser = new PDFParse({ data: pdfBuffer });
        const { text } = await parser.getText();
        const { offRating, defRating } = parsePdfEfficiency(text);
        if (offRating !== null) data.game.offRating = offRating;
        if (defRating !== null) data.game.defRating = defRating;
      }
    } catch {
      // PDF fetch/parse failure is non-fatal -- ratings will be omitted
    }
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
