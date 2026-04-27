import { describe, it, expect } from "vitest";
import { parseListingHtml } from "@/server/integrations/scraper/listing";

const LISTING_URL = "https://basketcity.sportstats.gr/men/teamdetails/id/BED40AE7-E186-454A-AF1D-9010E46EC048";

function row(opts: {
  href:    string;
  date:    string;
  left:    string;
  right:   string;
  status?: "past" | "upcoming";
}): string {
  const cls = opts.status ?? "past";
  return `
    <li class="${cls}">
      <a class="schedule_main_content" href="${opts.href}">
        <div class="date">${opts.date}</div>
        <table class="country left"><tr><td><div class="name">${opts.left}</div></td></tr></table>
        <table class="country right"><tr><td><div class="name">${opts.right}</div></td></tr></table>
      </a>
    </li>`;
}

describe("parseListingHtml", () => {
  it("extracts past rows and identifies AK on the left side as away", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/AAA",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "Παναθηναϊκός",
    })}</ul>`;
    const rows = parseListingHtml(html, LISTING_URL);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      gameUrl:  "https://basketcity.sportstats.gr/men/gamedetails/id/AAA",
      opponent: "Παναθηναϊκός",
      isHome:   false,
      homeTeam: "Παναθηναϊκός",
      awayTeam: "ARMANI KATEHANO",
    });
    expect(rows[0].playedOn.toISOString().slice(0, 10)).toBe("2026-04-25");
  });

  it("identifies AK on the right side as home and matches Greek script", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/BBB",
      date:  "Κυριακή, 1 Μαρτίου 2026",
      left:  "ΑΡΗΣ",
      right: "ΑΡΜΑΝΙ ΚΑΤΕΧΑΝΟ",
    })}</ul>`;
    const rows = parseListingHtml(html, LISTING_URL);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      opponent: "ΑΡΗΣ",
      isHome:   true,
      homeTeam: "ΑΡΜΑΝΙ ΚΑΤΕΧΑΝΟ",
      awayTeam: "ΑΡΗΣ",
    });
  });

  it("dedupes repeated entries by gameUrl", () => {
    const dup = row({
      href:  "/men/gamedetails/id/CCC",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΑΡΗΣ",
    });
    const rows = parseListingHtml(`<ul>${dup}${dup}${dup}</ul>`, LISTING_URL);
    expect(rows).toHaveLength(1);
  });

  it("absolutises relative hrefs against the listing origin", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/DDD",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΑΡΗΣ",
    })}</ul>`;
    const rows = parseListingHtml(html, LISTING_URL);
    expect(rows[0].gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/DDD");
  });

  it("preserves absolute hrefs as-is", () => {
    const href = "https://basketcity.sportstats.gr/men/gamedetails/id/EEE";
    const html = `<ul>${row({
      href,
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΑΡΗΣ",
    })}</ul>`;
    const rows = parseListingHtml(html, LISTING_URL);
    expect(rows[0].gameUrl).toBe(href);
  });

  it("ignores upcoming rows (only li.past has a gamedetails URL)", () => {
    const html = `<ul>${row({
      href:   "/men/gamedetails/id/FFF",
      date:   "Σάββατο, 25 Απριλίου 2026",
      left:   "ARMANI KATEHANO",
      right:  "ΑΡΗΣ",
      status: "upcoming",
    })}</ul>`;
    expect(parseListingHtml(html, LISTING_URL)).toEqual([]);
  });

  it("skips rows with an unparseable date", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/GGG",
      date:  "tomorrow",
      left:  "ARMANI KATEHANO",
      right: "ΑΡΗΣ",
    })}</ul>`;
    expect(parseListingHtml(html, LISTING_URL)).toEqual([]);
  });

  it("skips rows where neither team is AK", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/HHH",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ΑΡΗΣ",
      right: "Παναθηναϊκός",
    })}</ul>`;
    expect(parseListingHtml(html, LISTING_URL)).toEqual([]);
  });

  it("skips rows where both teams look like AK (ambiguous)", () => {
    const html = `<ul>${row({
      href:  "/men/gamedetails/id/III",
      date:  "Σάββατο, 25 Απριλίου 2026",
      left:  "ARMANI KATEHANO",
      right: "ΚΑΤΕΧΑΝΟ B",
    })}</ul>`;
    expect(parseListingHtml(html, LISTING_URL)).toEqual([]);
  });

  it("skips rows missing one of the team names", () => {
    const html = `
      <ul>
        <li class="past">
          <a class="schedule_main_content" href="/men/gamedetails/id/JJJ">
            <div class="date">Σάββατο, 25 Απριλίου 2026</div>
            <table class="country left"><tr><td><div class="name">ARMANI KATEHANO</div></td></tr></table>
            <table class="country right"><tr><td><div class="name"></div></td></tr></table>
          </a>
        </li>
      </ul>`;
    expect(parseListingHtml(html, LISTING_URL)).toEqual([]);
  });

  it("returns empty when no li.past nodes exist", () => {
    expect(parseListingHtml(`<html><body><p>nothing</p></body></html>`, LISTING_URL)).toEqual([]);
  });

  it("falls back to the gamedetails-href selector when schedule_main_content is missing", () => {
    const html = `
      <ul>
        <li class="past">
          <a href="/men/gamedetails/id/KKK">link</a>
          <div class="date">Σάββατο, 25 Απριλίου 2026</div>
          <table class="country left"><tr><td><div class="name">ARMANI KATEHANO</div></td></tr></table>
          <table class="country right"><tr><td><div class="name">ΑΡΗΣ</div></td></tr></table>
        </li>
      </ul>`;
    const rows = parseListingHtml(html, LISTING_URL);
    expect(rows).toHaveLength(1);
    expect(rows[0].gameUrl).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/KKK");
  });
});
