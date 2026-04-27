/**
 * Given an UpcomingGame whose admin set a listingUrl, fetch that listing,
 * find the row matching this game (date + fuzzy opponent), and return the
 * gamedetails URL the listing exposes for it (or null if not yet published).
 */

import { assertSsrfSafe }   from "@/server/security/ssrf";
import { parseListingHtml } from "@/server/integrations/scraper/listing";

const LEVENSHTEIN_MAX_RATIO = 0.40;

export class ListingFetchError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ListingFetchError";
  }
}

// Maps each uppercase Greek letter to its conventional Latin transliteration
// so that team names entered in one script can match listings written in the
// other (e.g. "Xlatsers Legends" ↔ "ΧΛΑΤΣΕΡΣ LEGENDS").
const GREEK_TO_LATIN: Record<string, string> = {
  Α: "A",  Β: "V",  Γ: "G",  Δ: "D",  Ε: "E",  Ζ: "Z",  Η: "I",  Θ: "TH",
  Ι: "I",  Κ: "K",  Λ: "L",  Μ: "M",  Ν: "N",  Ξ: "X",  Ο: "O",  Π: "P",
  Ρ: "R",  Σ: "S",  Τ: "T",  Υ: "Y",  Φ: "F",  Χ: "X",  Ψ: "PS", Ω: "O",
};

function normalize(s: string): string {
  const stripped = s.normalize("NFD").replace(/[̀-ͯ]/g, "").toUpperCase().trim();
  return stripped.replace(/[Α-Ω]/g, ch => GREEK_TO_LATIN[ch] ?? ch);
}

function levenshtein(a: string, b: string): number {
  const m = a.length, n = b.length;
  const row = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = row[0];
    row[0]   = i;
    for (let j = 1; j <= n; j++) {
      const tmp = Reflect.get(row, j) as number;
      Reflect.set(row, j, a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, tmp, Reflect.get(row, j - 1) as number));
      prev = tmp;
    }
  }
  return Reflect.get(row, n) as number;
}

async function fetchListing(listingUrl: string): Promise<string> {
  await assertSsrfSafe(listingUrl).catch(() => {
    throw new ListingFetchError("listingUrl not allowed", 400);
  });

  let response: Response;
  try {
    response = await fetch(listingUrl, {
      redirect: "manual",
      headers: {
        "User-Agent":      "BoxScoreScraper/1.0",
        "Accept":          "text/html,application/xhtml+xml",
        "Accept-Language": "el-GR,el;q=0.9,en;q=0.8",
      },
    });
  } catch (err) {
    throw new ListingFetchError(`Listing unreachable: ${(err as Error).message}`, 502);
  }

  if (response.status >= 300 && response.status < 400)
    throw new ListingFetchError("Listing redirected — refusing to follow.", 502);
  if (!response.ok)
    throw new ListingFetchError(`Listing returned ${response.status}`, 502);

  return response.text();
}

export interface DiscoverInput {
  listingUrl:   string;
  scheduledFor: Date;
  opponent:     string;
}

export interface DiscoverResult {
  gameUrl:  string | null;
  reason:   string;
}

export async function discoverSourceUrl(input: DiscoverInput): Promise<DiscoverResult> {
  const html = await fetchListing(input.listingUrl);
  const rows = parseListingHtml(html, input.listingUrl);

  if (rows.length === 0)
    return { gameUrl: null, reason: "listing parsed but contained no recognised games" };

  const targetDay = new Date(Date.UTC(
    input.scheduledFor.getUTCFullYear(),
    input.scheduledFor.getUTCMonth(),
    input.scheduledFor.getUTCDate(),
  )).getTime();

  const sameDay = rows.filter(r => r.playedOn.getTime() === targetDay);
  if (sameDay.length === 0)
    return { gameUrl: null, reason: `no listing row for ${new Date(targetDay).toISOString().slice(0, 10)}` };

  const normTarget = normalize(input.opponent);
  let best: typeof sameDay[number] | null = null;
  let bestDist = Infinity;

  for (const row of sameDay) {
    const normRow = normalize(row.opponent);
    const dist    = levenshtein(normTarget, normRow);
    const ratio   = dist / Math.max(normTarget.length, normRow.length, 1);
    if (ratio <= LEVENSHTEIN_MAX_RATIO && dist < bestDist) {
      bestDist = dist;
      best     = row;
    }
  }

  if (!best)
    return { gameUrl: null, reason: `${sameDay.length} row(s) on that date but none matched opponent "${input.opponent}"` };

  return { gameUrl: best.gameUrl, reason: `matched listing row (opponent="${best.opponent}", dist=${bestDist})` };
}
