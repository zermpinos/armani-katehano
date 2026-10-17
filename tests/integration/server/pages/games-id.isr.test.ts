// @ts-nocheck
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

const mockGetGameIds  = vi.fn();
const mockGetGameById = vi.fn();
const mockGetAllGames = vi.fn();

vi.mock("@/server/db/client", () => ({
  default: { $connect: vi.fn() },
  prisma:  { $connect: vi.fn() },
}));
vi.mock("@/server/db/repositories", () => ({
  getGameIds:  mockGetGameIds,
  getGameById: mockGetGameById,
  getAllGames: mockGetAllGames,
}));

let getStaticProps: any;
let getStaticPaths: any;

beforeAll(async () => {
  const mod  = await import("../../../../pages/games/[id]");
  getStaticProps = mod.getStaticProps;
  getStaticPaths = mod.getStaticPaths;
});

beforeEach(() => {
  vi.clearAllMocks();
});

const VALID_CUID = "clxxxxxxxxxxxxxxxxxxxxxxx";

describe("getStaticPaths /games/[id]", () => {
  it("returns paths and fallback: blocking", async () => {
    mockGetGameIds.mockResolvedValue([VALID_CUID]);
    const result = await getStaticPaths();
    expect(result.fallback).toBe("blocking");
    expect(result.paths).toContainEqual({ params: { id: VALID_CUID } });
  });

  it("returns empty paths and blocking fallback on DB error", async () => {
    mockGetGameIds.mockRejectedValue(new Error("db down"));
    const result = await getStaticPaths();
    expect(result.paths).toEqual([]);
    expect(result.fallback).toBe("blocking");
  });
});

describe("getStaticProps /games/[id]", () => {
  it("returns notFound for malformed id without DB call", async () => {
    const result = await getStaticProps({ params: { id: "not-a-cuid!!" } });
    expect(result).toEqual({ notFound: true });
    expect(mockGetGameById).not.toHaveBeenCalled();
  });

  it("returns notFound when game does not exist", async () => {
    mockGetGameById.mockResolvedValue(null);
    const result = await getStaticProps({ params: { id: VALID_CUID } });
    expect(result).toEqual({ notFound: true });
  });

  it("returns the game, its earlier meetings and revalidate: 86400", async () => {
    const game = { id: VALID_CUID, opponent: "Test", date: "2026-09-12" };
    mockGetGameById.mockResolvedValue(game);
    mockGetAllGames.mockResolvedValue([
      { id: VALID_CUID, date: "2026-09-12", opponent: "Test", home: true, result: "W", score: "60-50", season: "2026-27", leagueName: "Winter Cup" },
      { id: "clearlierxxxxxxxxxxxxxxxx", date: "2026-01-10", opponent: "Test", home: false, result: "L", score: "50-60", season: "2025-26", leagueName: "Winter Cup" },
    ]);
    const result = await getStaticProps({ params: { id: VALID_CUID } });
    expect(result).toMatchObject({ props: { game }, revalidate: 86400 });
    expect(result.props.earlier.meetings.map((m: any) => m.id)).toEqual(["clearlierxxxxxxxxxxxxxxxx"]);
  });
});
