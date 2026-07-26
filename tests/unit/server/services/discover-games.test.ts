// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockFetchGuarded } = vi.hoisted(() => ({ mockFetchGuarded: vi.fn() }));
vi.mock("@/server/services/scrape-game", () => ({ fetchGuarded: mockFetchGuarded }));

import { discoverGames } from "@/server/services/discover-games";

const MEN = "https://basketcity.sportstats.gr/men/teamdetails/id/TEAM";
const CUP = "https://basketcity.sportstats.gr/winter-cup/teamdetails/id/TEAM";

function page(...rows) {
  return `<div class="schedule_list"><ul>${rows.join("")}</ul></div>`;
}
function row({ path, title = "BC6<br />1ος Γύρος", score = null }) {
  const points = score
    ? `<table class='points'><tbody><tr><td><div class='number a'>${score[0]}</div><div class='number b'>${score[1]}</div></td></tr></tbody></table>`
    : "";
  return `<li class='past'><a class='schedule_main_content' href='${path}'>
    <div class='title'>${title}</div><div class='date'>Σάββατο, 16 Μαΐου 2026</div>
    <div class='participants'>${points}</div></a></li>`;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.SCRAPE_LISTING_URL_MEN = MEN;
  process.env.SCRAPE_LISTING_URL_CUP = CUP;
});

describe("discoverGames", () => {
  it("returns only games the organisers have posted a result for", async () => {
    mockFetchGuarded.mockResolvedValue(page(
      row({ path: "/men/gamedetails/id/AAA", score: [70, 60] }),
      row({ path: "/men/gamedetails/id/BBB" }),
    ));
    const { games, errors } = await discoverGames();
    expect(errors).toEqual([]);
    expect(games.map(g => g.gameId)).toEqual(["AAA"]);
  });

  it("reads both listings", async () => {
    mockFetchGuarded
      .mockResolvedValueOnce(page(row({ path: "/men/gamedetails/id/AAA", score: [1, 2] })))
      .mockResolvedValueOnce(page(row({ path: "/winter-cup/gamedetails/id/CCC", title: "Προκριματικοι", score: [3, 4] })));
    const { games } = await discoverGames();
    expect(mockFetchGuarded.mock.calls.map(c => c[0])).toEqual([MEN, CUP]);
    expect(games.map(g => g.leagueSlug)).toEqual(["bc6", "wintercup"]);
  });

  // The cup page has served the same game under /winter-cup/ and
  // /super-winter-cup/, so the id is the identity, not the URL.
  it("keeps one entry when both listings carry the same game id", async () => {
    mockFetchGuarded
      .mockResolvedValueOnce(page(row({ path: "/men/gamedetails/id/DUP", score: [1, 2] })))
      .mockResolvedValueOnce(page(row({ path: "/super-winter-cup/gamedetails/id/DUP", score: [1, 2] })));
    const { games } = await discoverGames();
    expect(games).toHaveLength(1);
  });

  // One league being down should not stop the other importing.
  it("reports a listing that fails and still returns the other", async () => {
    mockFetchGuarded
      .mockRejectedValueOnce(new Error("Upstream unreachable"))
      .mockResolvedValueOnce(page(row({ path: "/winter-cup/gamedetails/id/CCC", score: [3, 4] })));
    const { games, errors } = await discoverGames();
    expect(games.map(g => g.gameId)).toEqual(["CCC"]);
    expect(errors).toEqual(["SCRAPE_LISTING_URL_MEN: Upstream unreachable"]);
  });

  it("reports a listing url that is not configured", async () => {
    delete process.env.SCRAPE_LISTING_URL_CUP;
    mockFetchGuarded.mockResolvedValue(page(row({ path: "/men/gamedetails/id/AAA", score: [1, 2] })));
    const { errors } = await discoverGames();
    expect(errors).toEqual(["SCRAPE_LISTING_URL_CUP is not set"]);
  });
});
