import "@/server/_internal/node-only";
import * as cheerio from "cheerio";
import { isUsTeam } from "@/domain/import/identity";

// The organisers upload every game in the league to this channel; the Videos
// tab on the game page is an empty template. The feed holds only the latest 15
// uploads, roughly two days of games, so a video posted well before the run
// that imports its game can already have scrolled off.
export const VIDEO_FEED_URL = "https://www.youtube.com/feeds/videos.xml?channel_id=UC20kS2_s7aqnYMKdkzjiZqg";

// Typed by hand, so 19/9/26, 01/05/26 and 12/9/2026 all turn up.
const TITLE_DATE = /(\d{1,2})\/(\d{1,2})\/(\d{4}|\d{2})(?!\d)/g;
const VIDEO_ID   = /^[\w-]{11}$/;

const dayKey = (y: number, m: number, d: number) => `${y}-${m}-${d}`;

function titleDays(title: string): string[] {
  return [...title.matchAll(TITLE_DATE)].map(([, d, m, y]) =>
    dayKey(y.length === 2 ? 2000 + Number(y) : Number(y), Number(m), Number(d)));
}

// The date is what ties an upload to a game: the opponent is spelt however the
// uploader likes. Two matches is a re-upload or a second clip, and picking one
// would be a guess.
export function findGameVideo(feedXml: string, playedOn: Date): string | null {
  const day = dayKey(playedOn.getUTCFullYear(), playedOn.getUTCMonth() + 1, playedOn.getUTCDate());
  const $ = cheerio.load(feedXml, { xml: true });
  const ids = $("entry").toArray()
    .filter(el => {
      const title = $(el).children("title").text();
      return isUsTeam(title) && titleDays(title).includes(day);
    })
    .map(el => $(el).children("yt\\:videoId").text().trim());
  return ids.length === 1 && VIDEO_ID.test(ids[0]) ? `https://www.youtube.com/watch?v=${ids[0]}` : null;
}
