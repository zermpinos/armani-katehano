// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    upcomingGame: {
      findMany: vi.fn(),
    },
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));

import { getUpcomingGamesWithAnnouncements } from "@/server/db/repositories/upcoming-games";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("getUpcomingGamesWithAnnouncements", () => {
  it("selects photoUrl and slug on the included player", async () => {
    mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
    await getUpcomingGamesWithAnnouncements();
    const args = mockPrisma.upcomingGame.findMany.mock.calls[0][0];
    const select = args.include.announcement.include.players.include.player.select;
    expect(select.photoUrl).toBe(true);
    expect(select.slug).toBe(true);
    expect(select.id).toBe(true);
    expect(select.name).toBe(true);
    expect(select.number).toBe(true);
    expect(select.position).toBe(true);
  });

  it("maps photoUrl (or null) and slug onto each returned player", async () => {
    mockPrisma.upcomingGame.findMany.mockResolvedValue([
      {
        id:           "g1",
        opponent:     "Pannonios",
        scheduledFor: new Date("2099-01-31T19:30:00Z"),
        location:     "home",
        competition:  null,
        notes:        null,
        announcement: {
          message:     "Stay locked in.",
          publishedAt: new Date("2099-01-28T10:00:00Z"),
          players: [
            {
              note: "starter",
              player: {
                id:       "p1",
                name:     "Petros Karras",
                number:   4,
                position: "PG",
                photoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p1.jpg",
                slug:     "petros-karras",
              },
            },
            {
              note: null,
              player: {
                id:       "p2",
                name:     "Theo Kourtis",
                number:   5,
                position: "G",
                photoUrl: null,
                slug:     "theo-kourtis",
              },
            },
          ],
        },
      },
    ]);

    const out = await getUpcomingGamesWithAnnouncements();
    expect(out).toHaveLength(1);
    const players = out[0].announcement.players;
    expect(players[0]).toMatchObject({
      id:       "p1",
      name:     "Petros Karras",
      number:   4,
      position: "PG",
      note:     "starter",
      photoUrl: "https://res.cloudinary.com/demo/image/upload/v1/p1.jpg",
      slug:     "petros-karras",
    });
    expect(players[1]).toMatchObject({
      id:       "p2",
      photoUrl: null,
      slug:     "theo-kourtis",
    });
  });
});
