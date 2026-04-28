// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

vi.mock("@/server/security/node/ssrf", () => ({
  assertSsrfSafe: vi.fn().mockResolvedValue(undefined),
}));

import { discoverSourceUrl, ListingFetchError } from "@/server/services/discover-source-url";
import { assertSsrfSafe } from "@/server/security/node/ssrf";

const LISTING_URL = "https://basketcity.sportstats.gr/men/teamdetails/id/BED40AE7-E186-454A-AF1D-9010E46EC048";

function rowHtml(opts: { href: string; date: string; left: string; right: string }): string {
  return `
    <li class="past">
      <a class="schedule_main_content" href="${opts.href}">
        <div class="date">${opts.date}</div>
        <table class="country left"><tr><td><div class="name">${opts.left}</div></td></tr></table>
        <table class="country right"><tr><td><div class="name">${opts.right}</div></td></tr></table>
      </a>
    </li>`;
}

function htmlOk(body: string): Response {
  return new Response(body, {
    status:  200,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  }) as unknown as Response;
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", fetchMock);
  vi.mocked(assertSsrfSafe).mockResolvedValue(undefined);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("discoverSourceUrl", () => {
  it("matches by date and exact opponent and returns the gamedetails URL", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/AAA",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Παναθηναϊκός",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/AAA");
    expect(fetchMock).toHaveBeenCalledWith(LISTING_URL, expect.objectContaining({
      redirect: "manual",
      headers:  expect.objectContaining({ "User-Agent": "BoxScoreScraper/1.0" }),
    }));
  });

  it("matches an opponent within the Levenshtein threshold (typo / accents)", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/BBB",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Παναθηναϊκος B.C.",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/BBB");
  });

  it("matches a Latin opponent against a Greek listing row via transliteration", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/master-winter-cup/gamedetails/id/XLEG",
      date:  "Πέμπτη, 9 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΧΛΑΤΣΕΡΣ LEGENDS",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 9, 19, 0)),
      opponent:     "Xlatsers Legends",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/master-winter-cup/gamedetails/id/XLEG");
  });

  it("matches a Greek opponent against a Latin listing row via transliteration", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/SHRK",
      date:  "Σάββατο, 1 Νοεμβρίου 2025",
      left:  "ARMANI KATEHANO",
      right: "SHARKS",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2025, 10, 1, 19, 0)),
      opponent:     "ΣΑΡΚΣ",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/SHRK");
  });

  it("returns null when the listing has no rows", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<html><body></body></html>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBeNull();
    expect(result.reason).toMatch(/no recognised games/i);
  });

  it("returns null when no row is on the requested UTC date", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/CCC",
      date:  "Σάββατο, 18 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Παναθηναϊκός",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBeNull();
    expect(result.reason).toContain("2026-04-25");
  });

  it("returns null when same-date rows exist but no opponent is close enough", async () => {
    fetchMock.mockResolvedValue(htmlOk(`<ul>${rowHtml({
      href:  "/men/gamedetails/id/DDD",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Ολυμπιακός",
    })}</ul>`));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "Παναθηναϊκός",
    });

    expect(result.gameUrl).toBeNull();
    expect(result.reason).toMatch(/none matched opponent/i);
  });

  it("picks the closest opponent when multiple same-date rows are within threshold", async () => {
    const html = `<ul>
      ${rowHtml({ href: "/men/gamedetails/id/X1", date: "Σάββατο, 25 Απριλίου 2026", left: "ARMANI KATEHANO", right: "ΑΡΗΣ ΘΕΣΣΑΛΟΝΙΚΗΣ" })}
      ${rowHtml({ href: "/men/gamedetails/id/X2", date: "Σάββατο, 25 Απριλίου 2026", left: "ARMANI KATEHANO", right: "ΑΡΗΣ" })}
    </ul>`;
    fetchMock.mockResolvedValue(htmlOk(html));

    const result = await discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΑΡΗΣ",
    });

    expect(result.gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/X2");
  });

  it("throws ListingFetchError when SSRF check rejects", async () => {
    vi.mocked(assertSsrfSafe).mockRejectedValueOnce(new Error("blocked"));
    await expect(discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΑΡΗΣ",
    })).rejects.toMatchObject({ name: "ListingFetchError", status: 400 });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("throws ListingFetchError on a non-OK response", async () => {
    fetchMock.mockResolvedValue(new Response("nope", { status: 500 }) as unknown as Response);
    await expect(discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΑΡΗΣ",
    })).rejects.toBeInstanceOf(ListingFetchError);
  });

  it("throws ListingFetchError on a redirect (refuses to follow)", async () => {
    fetchMock.mockResolvedValue(new Response("", {
      status:  302,
      headers: { Location: "https://elsewhere.example/" },
    }) as unknown as Response);
    await expect(discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΑΡΗΣ",
    })).rejects.toMatchObject({ name: "ListingFetchError", status: 502 });
  });

  it("wraps a fetch network error as ListingFetchError(502)", async () => {
    fetchMock.mockRejectedValue(new Error("ECONNRESET"));
    await expect(discoverSourceUrl({
      listingUrl:   LISTING_URL,
      scheduledFor: new Date(Date.UTC(2026, 3, 25, 19, 0)),
      opponent:     "ΑΡΗΣ",
    })).rejects.toMatchObject({ name: "ListingFetchError", status: 502 });
  });
});
