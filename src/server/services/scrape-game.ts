import "@/server/_internal/node-only";
import { createHash } from "node:crypto";
import type { Agent } from "undici";
import { scrapeGame } from "@/server/integrations/scraper/boxscore";
import { ScrapedGameSchema } from "@/schemas/box-score";
import { assertSsrfSafe, makeLockedDispatcher } from "@/server/security/node/ssrf";
import { classifyScrapedGame, type ClassifyResult } from "@/domain/import/classify";

// Node.js's native fetch (undici-backed) accepts a non-standard `dispatcher` option
// that pins the connection to an already-resolved IP, closing the TOCTOU gap.
// Derived from fetch's own signature to avoid referencing RequestInit as a bare global.
type NodeRequestInit = NonNullable<Parameters<typeof fetch>[1]> & { dispatcher: Agent };

// Bounds the poll, which scrapes several URLs inside one function budget. An
// interactive scrape has a human to close the tab; a cron job does not.
const FETCH_TIMEOUT_MS = 8_000;

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
  bytesHash: string;
}

export async function scrapeGameFromUrl(url: string): Promise<ScrapeResult> {
  const { address } = await assertSsrfSafe(url).catch(() => {
    throw new ScrapeError("URL not allowed", 400);
  });

  // Connect directly to the pre-validated IP - no second DNS resolution at fetch time.
  const dispatcher = makeLockedDispatcher(address);
  let html: string;
  try {
    const response = await fetch(url, {
      redirect: "manual",
      headers: {
        "User-Agent": "BoxScoreScraper/1.0",
        "Accept":     "text/html,application/xhtml+xml",
      },
      dispatcher,
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    } as NodeRequestInit);

    if (response.status >= 300 && response.status < 400)
      throw new ScrapeError("Upstream redirected - refusing to follow.", 502);

    if (!response.ok)
      throw new ScrapeError(`Upstream returned ${response.status}`, 502);

    html = await response.text();
  } catch (err) {
    if (err instanceof ScrapeError) throw err;
    throw new ScrapeError(`Upstream unreachable: ${(err as Error).message}`, 502);
  } finally {
    await dispatcher.destroy().catch(() => {});
  }

  let data: any;
  try {
    data = scrapeGame(html, url);
  } catch (err) {
    throw new ScrapeError((err as Error).message, 422);
  }

  const validation = ScrapedGameSchema.safeParse(data);
  if (!validation.success)
    throw new ScrapeError("Scraped data has unexpected shape - the source site may have changed format.", 422);

  if (!data.teams.length)
    throw new ScrapeError("No box score found - check the URL points to a game details page.", 422);

  const gameState = classifyScrapedGame(data);

  return { data, gameState, bytesHash: createHash("sha256").update(html).digest("hex") };
}
