import dns        from "dns";
import { PDFParse }  from "pdf-parse";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";
import { ScrapedGameSchema } from "@/schemas";
import { assertSsrfSafe, isAllowedHostname, isPrivateIp } from "@/server/security/ssrf";
import { classifyScrapedGame, type ClassifyResult } from "@/server/services/import-classifier";

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

export class ScrapeError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ScrapeError";
  }
}

export interface ScrapeResult {
  data: any;
  gameState: ClassifyResult;
}

export async function scrapeGameFromUrl(url: string): Promise<ScrapeResult> {
  await assertSsrfSafe(url).catch(() => {
    throw new ScrapeError("URL not allowed", 400);
  });

  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "BoxScoreScraper/1.0",
        "Accept":     "text/html,application/xhtml+xml",
      },
    });
  } catch (err) {
    throw new ScrapeError(`Upstream unreachable: ${(err as Error).message}`, 502);
  }

  if (response.status >= 300 && response.status < 400)
    throw new ScrapeError("Upstream redirected — refusing to follow.", 502);

  if (!response.ok)
    throw new ScrapeError(`Upstream returned ${response.status}`, 502);

  const html = await response.text();

  let data: any;
  try {
    data = scrapeGame(html, url);
  } catch (err) {
    throw new ScrapeError((err as Error).message, 422);
  }

  const pdfUrl = typeof data.game?.pdfUrl === "string" ? data.game.pdfUrl : null;
  if (pdfUrl) {
    try {
      const pdfUrlObj = new URL(pdfUrl);
      if (!isAllowedHostname(pdfUrlObj.hostname)) throw new Error("PDF host not allowed");

      const { address: pdfAddress } = await dns.promises.lookup(pdfUrlObj.hostname);
      if (isPrivateIp(pdfAddress)) throw new Error("PDF host resolves to private IP");

      const pdfResponse = await fetch(pdfUrl, {
        redirect: "manual",
        headers: { "User-Agent": "BoxScoreScraper/1.0" },
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
      // PDF fetch/parse failure is non-fatal — ratings will be omitted
    }
  }

  const validation = ScrapedGameSchema.safeParse(data);
  if (!validation.success)
    throw new ScrapeError("Scraped data has unexpected shape — the source site may have changed format.", 422);

  if (!data.teams.length)
    throw new ScrapeError("No box score found — check the URL points to a game details page.", 422);

  const gameState = classifyScrapedGame(data);

  return { data, gameState };
}
