// @ts-nocheck
import { describe, it, expect } from "vitest";
import { findGameVideo } from "@/server/integrations/scraper/video-feed";

// Shape taken from the live channel feed: one <entry> per upload, newest first,
// every game in the league, and a title the uploader types by hand.
const entry = (videoId, title) => `
 <entry>
  <id>yt:video:${videoId}</id>
  <yt:videoId>${videoId}</yt:videoId>
  <title>${title}</title>
  <link rel="alternate" href="https://www.youtube.com/watch?v=${videoId}"/>
  <published>2026-09-19T13:21:37+00:00</published>
 </entry>`;

const feed = (...entries) => `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns="http://www.w3.org/2005/Atom">
 <title>Web Tv Basket City</title>${entries.join("")}
</feed>`;

const SEP_19 = new Date(Date.UTC(2026, 8, 19));
const watch  = id => `https://www.youtube.com/watch?v=${id}`;

describe("findGameVideo", () => {
  it("picks our upload for the date out of the rest of the league's", () => {
    const xml = feed(
      entry("h2a3hdhyZ2Y", "Ελληνορώσων bulls-Dragons ( Σάββατο 19/9/26)"),
      entry("2ebwcUbtvrA", "Armani Katehano-Atalantoi Hawks ( Σάββατο 19/9/26)"),
      entry("yAiDR7FoxO8", "Rouf Kings-Los Santos Lakers ( Σάββατο 19/9/26)"),
    );
    expect(findGameVideo(xml, SEP_19)).toBe(watch("2ebwcUbtvrA"));
  });

  it("reads a four-digit year and zero-padded day and month", () => {
    expect(findGameVideo(feed(entry("Sg_msmFkR18", "Armani katehano - New York Bricks( Σάββατο 12/9/2026)")),
      new Date(Date.UTC(2026, 8, 12)))).toBe(watch("Sg_msmFkR18"));
    expect(findGameVideo(feed(entry("AUkgXnRit3k", "Armani Katehano - Χλάτσερς Legends    01/05/26")),
      new Date(Date.UTC(2026, 4, 1)))).toBe(watch("AUkgXnRit3k"));
  });

  it("ignores our upload from another game", () => {
    const xml = feed(entry("Sg_msmFkR18", "Armani katehano - New York Bricks( Σάββατο 12/9/2026)"));
    expect(findGameVideo(xml, SEP_19)).toBeNull();
  });

  // Two candidates means a re-upload or a second clip, and picking one is a guess.
  it("attaches nothing when two uploads claim the same game", () => {
    const xml = feed(
      entry("2ebwcUbtvrA", "Armani Katehano-Atalantoi Hawks ( Σάββατο 19/9/26)"),
      entry("Q0-BWSdFIOA", "Armani Katehano-Atalantoi Hawks ( Σάββατο 19/9/26) part 2"),
    );
    expect(findGameVideo(xml, SEP_19)).toBeNull();
  });

  it("attaches nothing to a title with no date in it", () => {
    expect(findGameVideo(feed(entry("2ebwcUbtvrA", "Armani Katehano vs Cuba Libre")), SEP_19)).toBeNull();
  });

  // The URL is built from the id, so an id that is not one never reaches a link.
  it("refuses an entry whose id is not a video id", () => {
    const xml = feed(entry("javascript:alert(1)", "Armani Katehano-Atalantoi Hawks ( Σάββατο 19/9/26)"));
    expect(findGameVideo(xml, SEP_19)).toBeNull();
  });

  it("returns nothing for an empty feed", () => {
    expect(findGameVideo("", SEP_19)).toBeNull();
  });
});
