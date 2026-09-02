// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockFetchGuarded, mockPrisma } = vi.hoisted(() => ({
  mockFetchGuarded: vi.fn(),
  mockPrisma: { league: { findMany: vi.fn() } },
}));
vi.mock("@/server/services/scrape-game", () => ({ fetchGuarded: mockFetchGuarded }));
vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));

import { discoverGames } from "@/server/services/discover-games";

const MEN = "https://basketcity.sportstats.gr/men/teamdetails/id/TEAM";
const CUP = "https://basketcity.sportstats.gr/winter-cup/teamdetails/id/TEAM";

const LEAGUES = [
  { name: "BC6",        organization: "basketcity", listingUrl: MEN },
  { name: "Winter Cup", organization: "basketcity", listingUrl: CUP },
];

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
  mockPrisma.league.findMany.mockResolvedValue(LEAGUES);
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

  it("reads every league that carries a listing url", async () => {
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
    expect(errors).toEqual(["BC6: Upstream unreachable"]);
  });

  it("reports when no active league carries a listing url", async () => {
    mockPrisma.league.findMany.mockResolvedValue([]);
    const { games, errors } = await discoverGames();
    expect(games).toEqual([]);
    expect(errors).toEqual(["No active league has a listing URL configured"]);
    expect(mockFetchGuarded).not.toHaveBeenCalled();
  });

  // A listing we cannot parse would come back empty, which is indistinguishable
  // from a quiet week, so it is reported rather than fetched.
  it("skips a league whose organization has no listing parser", async () => {
    mockPrisma.league.findMany.mockResolvedValue([
      { name: "Golden League", organization: "jumpball", listingUrl: "https://www.jumpball.com.gr/calendar/golden/" },
    ]);
    const { games, errors } = await discoverGames();
    expect(games).toEqual([]);
    expect(errors).toEqual(["Golden League: no listing parser for jumpball"]);
    expect(mockFetchGuarded).not.toHaveBeenCalled();
  });
});
