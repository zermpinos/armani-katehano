// @ts-nocheck
import { vi, describe, it, expect, beforeAll } from "vitest";

vi.mock("@/server/db/client", () => ({
  default: { $connect: vi.fn() },
  prisma:  { $connect: vi.fn() },
}));

vi.mock("@/server/db/repositories", () => ({
  getAllPublicData:   vi.fn(),
  getAllSeasonsStats: vi.fn().mockResolvedValue({}),
  getPlayerGameLog:  vi.fn().mockResolvedValue([]),
  getSeasons:        vi.fn().mockResolvedValue([]),
}));

vi.mock("@/domain/stats", () => ({ buildAllTimeStatsMap: vi.fn().mockReturnValue({}) }));

import { getAllPublicData } from "@/server/db/repositories";

let getStaticProps: any;
let getStaticPaths: any;

beforeAll(async () => {
  const mod  = await import("../../../../pages/players/[slug]");
  getStaticProps = mod.getStaticProps;
  getStaticPaths = mod.getStaticPaths;
});

const ACTIVE_PLAYER = { id: "player-1", slug: "alex", name: "Alex", isActive: true };

const FULL_PUBLIC_DATA = (players: any[]) => ({
  players,
  games:         [],
  stats:         {},
  seasons:       [],
  currentSeason: null,
  config:        {},
  upcomingGames: [],
});

describe("getStaticPaths /players/[slug]", () => {
  it("returns active player slugs with fallback: blocking", async () => {
    (getAllPublicData as any).mockResolvedValue(
      FULL_PUBLIC_DATA([ACTIVE_PLAYER, { ...ACTIVE_PLAYER, slug: "bob", isActive: false }])
    );
    const result = await getStaticPaths();
    expect(result.fallback).toBe("blocking");
    expect(result.paths).toContainEqual({ params: { slug: "alex" } });
    expect(result.paths).not.toContainEqual({ params: { slug: "bob" } });
  });

  it("returns empty paths on DB error", async () => {
    (getAllPublicData as any).mockRejectedValue(new Error("db"));
    const result = await getStaticPaths();
    expect(result.paths).toEqual([]);
    expect(result.fallback).toBe("blocking");
  });
});

describe("getStaticProps /players/[slug]", () => {
  it("returns notFound for malformed slug without DB call", async () => {
    vi.clearAllMocks();
    const result = await getStaticProps({ params: { slug: "INVALID_SLUG!" } });
    expect(result).toEqual({ notFound: true });
    expect(getAllPublicData).not.toHaveBeenCalled();
  });

  it("returns notFound when player not found", async () => {
    (getAllPublicData as any).mockResolvedValue(FULL_PUBLIC_DATA([]));
    const result = await getStaticProps({ params: { slug: "alex" } });
    expect(result).toEqual({ notFound: true });
  });

  it("returns props and revalidate: 14400 when player exists", async () => {
    (getAllPublicData as any).mockResolvedValue(FULL_PUBLIC_DATA([ACTIVE_PLAYER]));
    const result = await getStaticProps({ params: { slug: "alex" } });
    expect(result).toMatchObject({
      props:      expect.objectContaining({ player: ACTIVE_PLAYER }),
      revalidate: 14400,
    });
  });
});
