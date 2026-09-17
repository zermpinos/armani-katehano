// @ts-nocheck
import { vi, describe, it, expect, beforeEach, afterEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    seasonLeague:  { findMany: vi.fn() },
    upcomingGame:  { findFirst: vi.fn(), create: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));

import { syncFixtures, suggestDisplayName } from "@/server/services/sync-fixtures";
import { buildAliases } from "@/domain/import/opponents";

const ALIASES = buildAliases([
  { scrapedName: "ATALANTOI HAWKS", displayName: "Atalantoi Hawks" },
]);

const WINTERCUP = {
  id: "sl-cup",
  league: { name: "Winter Cup", sourceSlug: "wintercup" },
};

// Shaped like a real listing row: Athens local time, venue in its own field.
function fixture(over = {}) {
  return {
    gameId: "G1", url: "https://basketcity.sportstats.gr/winter-cup/gamedetails/id/G1",
    leagueSlug: "wintercup", round: "regular",
    dateText: "Σάββατο, 19 Σεπτεμβρίου 2026", tipoff: "16:15",
    hasScore: false, opponent: "ATALANTOI HAWKS", venue: "ARENA", isHome: true,
    ...over,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  // Before the 19 Sep fixture, so it counts as upcoming.
  vi.setSystemTime(new Date("2026-09-17T19:00:00Z"));
  mockPrisma.seasonLeague.findMany.mockResolvedValue([WINTERCUP]);
  mockPrisma.upcomingGame.findFirst.mockResolvedValue(null);
});

describe("syncFixtures", () => {
  it("writes a fixture the site does not have yet", async () => {
    const out = await syncFixtures([fixture()], ALIASES);
    expect(out.created).toHaveLength(1);
    const { data } = mockPrisma.upcomingGame.create.mock.calls[0][0];
    expect(data.opponent).toBe("Atalantoi Hawks");
    // 16:15 Athens in September is EEST, so 13:15Z.
    expect(data.scheduledFor.toISOString()).toBe("2026-09-19T13:15:00.000Z");
    expect(data.location).toBe("home");
    expect(data.notes).toBe("ARENA");
    expect(data.seasonLeagueId).toBe("sl-cup");
    expect(data.competition).toBe("Winter Cup");
  });

  it("reads our team on the right as an away fixture", async () => {
    await syncFixtures([fixture({ isHome: false })], ALIASES);
    expect(mockPrisma.upcomingGame.create.mock.calls[0][0].data.location).toBe("away");
  });

  // The row carries the announcement the coach published, so a moved fixture
  // has to be edited rather than replaced.
  it("updates a rescheduled fixture in place and reports the move", async () => {
    mockPrisma.upcomingGame.findFirst.mockResolvedValue({
      id: "ug1", scheduledFor: new Date("2026-09-19T15:15:00.000Z"),
      location: "home", notes: "ARENA",
    });
    const out = await syncFixtures([fixture()], ALIASES);
    expect(mockPrisma.upcomingGame.create).not.toHaveBeenCalled();
    expect(mockPrisma.upcomingGame.update).toHaveBeenCalledWith({
      where: { id: "ug1" },
      data:  { scheduledFor: new Date("2026-09-19T13:15:00.000Z") },
    });
    expect(out.changed).toEqual([
      { opponent: "Atalantoi Hawks", field: "scheduledFor",
        from: "2026-09-19T15:15:00.000Z", to: "2026-09-19T13:15:00.000Z" },
    ]);
  });

  it("leaves an unchanged fixture alone", async () => {
    mockPrisma.upcomingGame.findFirst.mockResolvedValue({
      id: "ug1", scheduledFor: new Date("2026-09-19T13:15:00.000Z"),
      location: "home", notes: "ARENA",
    });
    const out = await syncFixtures([fixture()], ALIASES);
    expect(mockPrisma.upcomingGame.update).not.toHaveBeenCalled();
    expect(out.changed).toEqual([]);
  });

  // Same rule the import follows: a name we cannot write is reported, never
  // guessed at and never published in the source's shouting caps.
  it("reports an unmapped opponent with a suggestion and writes nothing", async () => {
    const out = await syncFixtures([fixture({ opponent: "BRAND NEW TEAM" })], ALIASES);
    expect(mockPrisma.upcomingGame.create).not.toHaveBeenCalled();
    expect(out.created).toEqual([]);
    expect(out.unmapped).toEqual([
      { scrapedName: "BRAND NEW TEAM", suggestion: "Brand New Team", dateText: "Σάββατο, 19 Σεπτεμβρίου 2026" },
    ]);
  });

  it("skips a league no open season runs", async () => {
    mockPrisma.seasonLeague.findMany.mockResolvedValue([]);
    const out = await syncFixtures([fixture()], ALIASES);
    expect(mockPrisma.upcomingGame.create).not.toHaveBeenCalled();
    expect(out.skipped[0]).toMatch(/no open season/);
  });

  it("skips a row with no readable kick-off rather than inventing one", async () => {
    const out = await syncFixtures([fixture({ tipoff: null })], ALIASES);
    expect(mockPrisma.upcomingGame.create).not.toHaveBeenCalled();
    expect(out.skipped[0]).toMatch(/date and time/);
  });

  // The men listing still carries last season's rows, including games the
  // organisers never scored. Those look unplayed forever.
  it("ignores an unscored row whose date has already passed", async () => {
    const out = await syncFixtures([fixture({ dateText: "Σάββατο, 17 Ιανουαρίου 2026", tipoff: "20:00" })], ALIASES);
    expect(mockPrisma.upcomingGame.create).not.toHaveBeenCalled();
    expect(out.created).toEqual([]);
    // Not an event anyone can act on, so it raises nothing either.
    expect(out.skipped).toEqual([]);
    expect(out.unmapped).toEqual([]);
  });

  it("does nothing at all when the listing has no fixtures", async () => {
    const out = await syncFixtures([], ALIASES);
    expect(mockPrisma.seasonLeague.findMany).not.toHaveBeenCalled();
    expect(out).toEqual({ created: [], changed: [], unmapped: [], skipped: [] });
  });
});

afterEach(() => { vi.useRealTimers(); });

describe("suggestDisplayName", () => {
  it("title cases the source's caps", () => {
    expect(suggestDisplayName("ATALANTOI HAWKS")).toBe("Atalantoi Hawks");
    expect(suggestDisplayName("PATISSIA THUNDERS")).toBe("Patissia Thunders");
  });

  // Why it stays a suggestion: no rule gets to the real spelling here.
  it("is wrong often enough to need confirming", () => {
    expect(suggestDisplayName("TAZ BOYS")).not.toBe("Taz Boyz");
  });
});
