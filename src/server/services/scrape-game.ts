import "@/server/_internal/node-only";
import dns        from "node:dns";
import type { Agent } from "undici";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";
import { ScrapedGameSchema } from "@/schemas";
import { assertSsrfSafe, isAllowedHostname, isPrivateIp, makeLockedDispatcher } from "@/server/security/node/ssrf";
import { classifyScrapedGame, type ClassifyResult } from "@/server/services/import-classifier";

// Node.js's native fetch (undici-backed) accepts a non-standard `dispatcher` option
// that pins the connection to an already-resolved IP, closing the TOCTOU gap.
// Derived from fetch's own signature to avoid referencing RequestInit as a bare global.
type NodeRequestInit = NonNullable<Parameters<typeof fetch>[1]> & { dispatcher: Agent };

const AK_IDENTIFIERS = ["ARMANI", "KATEHANO"];

function parsePdfEfficiency(text: string): { offRating: number | null; defRating: number | null } {
  // Accept commas or periods as decimal separator; case-insensitive for team name check.
  const effRegex = /Off\.?\s*\/\s*Def\.?\s+Efficiency:\s*([\d.,]+)\s*\/\s*([\d.,]+)/gi;
  const upper = text.toUpperCase();
  let m: RegExpExecArray | null;
  while ((m = effRegex.exec(text)) !== null) {
    const beforeMatch = upper.slice(0, m.index);
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
  const { address } = await assertSsrfSafe(url).catch(() => {
    throw new ScrapeError("URL not allowed", 400);
  });

  // Connect directly to the pre-validated IP -- no second DNS resolution at fetch time.
  const dispatcher = makeLockedDispatcher(address);
  let response: Response;
  try {
    response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "BoxScoreScraper/1.0",
        "Accept":     "text/html,application/xhtml+xml",
      },
      dispatcher,
    } as NodeRequestInit);
  } catch (err) {
    throw new ScrapeError(`Upstream unreachable: ${(err as Error).message}`, 502);
  } finally {
    await dispatcher.destroy().catch(() => {});
  }

  if (response.status >= 300 && response.status < 400)
    throw new ScrapeError("Upstream redirected -- refusing to follow.", 502);

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

      const { address: pdfIp } = await dns.promises.lookup(pdfUrlObj.hostname);
      if (isPrivateIp(pdfIp)) throw new Error("PDF host resolves to private IP");

      // Pin the PDF fetch to the validated IP, same TOCTOU fix as the main fetch.
      const pdfDispatcher = makeLockedDispatcher(pdfIp);
      let pdfResponse: Response;
      try {
        pdfResponse = await fetch(pdfUrl, {
          redirect: "manual",
          headers: { "User-Agent": "BoxScoreScraper/1.0" },
          dispatcher: pdfDispatcher,
        } as NodeRequestInit);
      } finally {
        await pdfDispatcher.destroy().catch(() => {});
      }

      if (pdfResponse.ok) {
        const pdfBuffer = Buffer.from(await pdfResponse.arrayBuffer());
        const { PDFParse } = await import("pdf-parse");
        const parser = new PDFParse({ data: pdfBuffer });
        const { text } = await parser.getText();
        const { offRating, defRating } = parsePdfEfficiency(text);
        if (offRating !== null) data.game.offRating = offRating;
        if (defRating !== null) data.game.defRating = defRating;
      }
    } catch (pdfErr) {
      // Non-fatal -- ratings will be omitted, but log so it's diagnosable
      console.warn("[scrape-game] PDF rating parse failed:", (pdfErr as Error).message);
    }
  }

  const validation = ScrapedGameSchema.safeParse(data);
  if (!validation.success)
    throw new ScrapeError("Scraped data has unexpected shape -- the source site may have changed format.", 422);

  if (!data.teams.length)
    throw new ScrapeError("No box score found -- check the URL points to a game details page.", 422);

  const gameState = classifyScrapedGame(data);

  return { data, gameState };
}
