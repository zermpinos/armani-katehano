// @ts-nocheck
import { describe, it, expect } from "vitest";
import { parseTeamSchedule } from "@/server/integrations/scraper/team-schedule";

const PAGE = "https://basketcity.sportstats.gr/men/teamdetails/id/TEAM";

// Shape taken from the live page: single-quoted attributes, the competition and
// round joined by <br />, and the score present only once a result is posted.
function row({ path, title, date, score = null }) {
  const points = score
    ? `<table class='points'><tbody><tr><td>
         <div class='number greyColor'>${score[0]}</div>
         <div class='versus'>vs</div>
         <div class='number orangeColor'>${score[1]}</div>
       </td></tr></tbody></table>`
    : "";
  return `<li class='past' style='margin-top: 11px;'>
    <a class='schedule_main_content' href='${path}'>
      <div class='details'>
        <div class='title blackColor'>${title}</div>
        <div class='wrapper'><div class='date'>${date}</div></div>
      </div>
      <div class='participants'>${points}</div>
    </a>
  </li>`;
}

const page = (...rows) => `<div class="schedule_list"><ul>${rows.join("")}</ul></div>`;

const bc6 = row({
  path: "/men/gamedetails/id/AAA", title: "BC6<br />1ος Γύρος",
  date: "Σάββατο, 16 Μαΐου 2026", score: [73, 53],
});

describe("parseTeamSchedule", () => {
  it("reads the game id, absolute url, league, round and score presence", () => {
    const [g] = parseTeamSchedule(page(bc6), PAGE);
    expect(g.gameId).toBe("AAA");
    expect(g.url).toBe("https://basketcity.sportstats.gr/men/gamedetails/id/AAA");
    expect(g.leagueSlug).toBe("bc6");
    expect(g.round).toBe("regular");
    expect(g.hasScore).toBe(true);
    expect(g.dateText).toBe("Σάββατο, 16 Μαΐου 2026");
  });

  // A /men/ URL is shared by three leagues, so the label is the only source.
  it("distinguishes the leagues that share the /men/ path", () => {
    const html = page(
      bc6,
      row({ path: "/men/gamedetails/id/BBB", title: "ROOKIE LEAGUE<br />1ος Γύρος", date: "1 Μαρτίου 2026", score: [1, 2] }),
      row({ path: "/men/gamedetails/id/CCC", title: "BC8<br />1ος Γύρος<br />1η αγωνιστικη", date: "1 Μαρτίου 2026", score: [1, 2] }),
    );
    expect(parseTeamSchedule(html, PAGE).map(g => g.leagueSlug)).toEqual(["bc6", "rookie", "bc8"]);
  });

  it("takes the cup league from the url, whatever the title says", () => {
    const html = page(row({
      path: "/winter-cup/gamedetails/id/DDD", title: "Προκριματικοι",
      date: "1 Μαρτίου 2026", score: [1, 2],
    }));
    expect(parseTeamSchedule(html, PAGE)[0].leagueSlug).toBe("wintercup");
  });

  it("maps the round labels the site uses, ignoring Greek accents", () => {
    const html = page(
      row({ path: "/men/gamedetails/id/E1", title: "BC6<br />Play Offs",        date: "1 Μαρτίου 2026", score: [1, 2] }),
      row({ path: "/men/gamedetails/id/E2", title: "BC6<br />Ημιτελική Φάση",   date: "1 Μαρτίου 2026", score: [1, 2] }),
      row({ path: "/men/gamedetails/id/E3", title: "BC6<br />Τελικός",          date: "1 Μαρτίου 2026", score: [1, 2] }),
      row({ path: "/men/gamedetails/id/E4", title: "WINTER SUPER CUP<br />Θέσεις 1-8", date: "1 Μαρτίου 2026", score: [1, 2] }),
    );
    expect(parseTeamSchedule(html, PAGE).map(g => g.round))
      .toEqual(["quarterfinal", "semifinal", "final", "regular"]);
  });

  it("reports a fixture with no result posted", () => {
    const html = page(row({ path: "/men/gamedetails/id/FFF", title: "BC8<br />1ος Γύρος", date: "Δευτέρα, 1 Ιανουαρίου 1900" }));
    const [g] = parseTeamSchedule(html, PAGE);
    expect(g.hasScore).toBe(false);
  });

  // The page renders each game twice, once under results and once under
  // fixtures, and only the results copy carries a score.
  it("collapses the two renderings of one game and keeps the score", () => {
    const html = page(
      row({ path: "/men/gamedetails/id/AAA", title: "BC6<br />1ος Γύρος", date: "Σάββατο, 16 Μαΐου 2026" }),
      bc6,
    );
    const games = parseTeamSchedule(html, PAGE);
    expect(games).toHaveLength(1);
    expect(games[0].hasScore).toBe(true);
  });

  it("drops the kick-off time the fixture rendering appends to the date", () => {
    const html = page(row({ path: "/men/gamedetails/id/GGG", title: "BC6", date: "Σάββατο, 16 Μαΐου 2026 / 18:30" }));
    expect(parseTeamSchedule(html, PAGE)[0].dateText).toBe("Σάββατο, 16 Μαΐου 2026");
  });

  it("leaves the league unresolved for a /men/ label it does not know", () => {
    const html = page(row({ path: "/men/gamedetails/id/HHH", title: "BC12<br />1ος Γύρος", date: "1 Μαρτίου 2026", score: [1, 2] }));
    expect(parseTeamSchedule(html, PAGE)[0].leagueSlug).toBeNull();
  });

  it("ignores a row with no game link", () => {
    expect(parseTeamSchedule(page("<li class='past'><div>no link</div></li>"), PAGE)).toEqual([]);
  });
});
