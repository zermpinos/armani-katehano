// @ts-nocheck
import { vi, describe, it, expect, beforeAll, beforeEach } from "vitest";

const mockGetAllGames      = vi.fn();
const mockGetOpponentNames = vi.fn();

vi.mock("@/server/db/client", () => ({ default: { $connect: vi.fn() }, prisma: { $connect: vi.fn() } }));
vi.mock("@/server/db/repositories", () => ({ getAllGames: mockGetAllGames, getOpponentNames: mockGetOpponentNames }));

let getStaticProps: any;
let getStaticPaths: any;

beforeAll(async () => {
  const mod = await import("../../../../pages/opponents/[slug]");
  getStaticProps = mod.getStaticProps;
  getStaticPaths = mod.getStaticPaths;
});

beforeEach(() => vi.clearAllMocks());

const game = { id: "cmgame0000000000000000001", date: "2026-09-12", opponent: "New York Bricks", home: true, result: "W", score: "68-61", season: "2026-27", leagueName: "Winter Cup" };

describe("getStaticPaths /opponents/[slug]", () => {
  it("returns a path per opponent and fallback: blocking", async () => {
    mockGetOpponentNames.mockResolvedValue(["New York Bricks", "B.C. Abla"]);
    const result = await getStaticPaths();
    expect(result.fallback).toBe("blocking");
    expect(result.paths).toEqual([{ params: { slug: "new-york-bricks" } }, { params: { slug: "b-c-abla" } }]);
  });

  it("skips names with an empty slug and duplicate slugs", async () => {
    mockGetOpponentNames.mockResolvedValue(["New York Bricks", "ΚΟΥΒΑΔΕΣ", "new york bricks"]);
    const result = await getStaticPaths();
    expect(result.paths).toEqual([{ params: { slug: "new-york-bricks" } }]);
  });

  it("returns empty paths on a DB error", async () => {
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetOpponentNames.mockRejectedValue(new Error("db down"));
    expect(await getStaticPaths()).toEqual({ paths: [], fallback: "blocking" });
    quiet.mockRestore();
  });
});

describe("getStaticProps /opponents/[slug]", () => {
  it("returns notFound for a malformed slug without a DB call", async () => {
    expect(await getStaticProps({ params: { slug: "Not_A_Slug!" } })).toEqual({ notFound: true });
    expect(mockGetAllGames).not.toHaveBeenCalled();
  });

  it("returns notFound for an opponent never played", async () => {
    mockGetAllGames.mockResolvedValue([game]);
    expect(await getStaticProps({ params: { slug: "delulu" } })).toEqual({ notFound: true });
  });

  it("returns an expiring notFound on a DB error", async () => {
    mockGetAllGames.mockRejectedValue(new Error("db down"));
    expect(await getStaticProps({ params: { slug: "new-york-bricks" } })).toEqual({ notFound: true, revalidate: 60 });
  });

  it("returns every meeting and revalidate: 86400", async () => {
    mockGetAllGames.mockResolvedValue([game]);
    const result = await getStaticProps({ params: { slug: "new-york-bricks" } });
    expect(result.revalidate).toBe(86400);
    expect(result.props.h2h).toMatchObject({ opponent: "New York Bricks", wins: 1, losses: 0, meetings: [{ id: game.id }] });
  });
});
