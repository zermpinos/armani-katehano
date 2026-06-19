// @ts-nocheck
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

const mockGetGameIds  = vi.fn();
const mockGetGameById = vi.fn();

vi.mock("@/server/db/client", () => ({
  default: { $connect: vi.fn() },
  prisma:  { $connect: vi.fn() },
}));
vi.mock("@/server/db/repositories", () => ({
  getGameIds:  mockGetGameIds,
  getGameById: mockGetGameById,
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

  it("returns props and revalidate: 86400 when game exists", async () => {
    const game = { id: VALID_CUID, opponent: "Test" };
    mockGetGameById.mockResolvedValue(game);
    const result = await getStaticProps({ params: { id: VALID_CUID } });
    expect(result).toMatchObject({ props: { game }, revalidate: 86400 });
  });
});
