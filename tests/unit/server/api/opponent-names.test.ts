// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const m = vi.hoisted(() => ({
  prisma: {
    cronRun:       { findFirst: vi.fn() },
    opponentAlias: { findMany: vi.fn(), create: vi.fn() },
  },
  aliases:    vi.fn(),
  audit:      vi.fn(),
  discover:   vi.fn(),
  sync:       vi.fn(),
  invalidate: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({ default: m.prisma }));
vi.mock("@/server/auth", () => ({ requireAuth: (h: any) => h }));
vi.mock("@/server/security/node", () => ({ auditLog: m.audit, getClientIp: () => "1.2.3.4" }));
vi.mock("@/server/services/import-pipeline", () => ({ loadOpponentAliases: m.aliases }));
vi.mock("@/server/services/discover-games", () => ({ discoverGames: m.discover }));
vi.mock("@/server/services/sync-fixtures", () => ({ syncFixtures: m.sync }));
vi.mock("@/server/services/cache-invalidation", () => ({ invalidateForScheduleMutation: m.invalidate }));

import handler from "../../../../pages/api/admin/opponent-names";

const req = (method: string, body: any = {}) => ({ method, body, query: {}, headers: {} });
function res() {
  return {
    statusCode: 0, body: null, revalidate: vi.fn(),
    status(c: number) { this.statusCode = c; return this; },
    json(b: any)      { this.body = b; return this; },
  } as any;
}

const known = new Map([["NEW YORK BRICKS", "New York Bricks"]]);
const unmapped = { scrapedName: "NY BRICKS", suggestion: "Ny Bricks", dateText: "Κυριακή, 18 Οκτωβρίου 2026" };

beforeEach(() => {
  vi.clearAllMocks();
  m.aliases.mockResolvedValue(known);
  m.prisma.cronRun.findFirst.mockResolvedValue({ summary: { fixtures: { unmapped: [unmapped] } } });
  m.prisma.opponentAlias.findMany.mockResolvedValue([{ displayName: "Miami Bricks" }, { displayName: "New York Bricks" }]);
  m.prisma.opponentAlias.create.mockResolvedValue({});
  m.discover.mockResolvedValue({ games: [], fixtures: [{ url: "u" }], errors: [] });
  m.sync.mockResolvedValue({ created: [{ opponent: "New York Bricks", scheduledFor: new Date("2026-10-18T22:30:00.000Z") }], changed: [], unmapped: [], skipped: [] });
});

describe("GET /api/admin/opponent-names", () => {
  it("returns the last successful run's waiting names and the existing display names", async () => {
    const r = res();
    await handler(req("GET"), r);
    expect(r.statusCode).toBe(200);
    expect(r.body).toEqual({
      waiting: [{ ...unmapped, waitingOn: "fixture" }],
      names:   ["Miami Bricks", "New York Bricks"],
    });
    expect(m.prisma.cronRun.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { job: "pollImports", ok: true } }));
  });
});

describe("POST /api/admin/opponent-names", () => {
  it("rejects an empty display name", async () => {
    const r = res();
    await handler(req("POST", { scrapedName: "NY BRICKS", displayName: "  " }), r);
    expect(r.statusCode).toBe(400);
    expect(m.prisma.opponentAlias.create).not.toHaveBeenCalled();
  });

  it("refuses a name that is already held, matched the way the lookup matches", async () => {
    const r = res();
    await handler(req("POST", { scrapedName: "new  york bricks", displayName: "Other" }), r);
    expect(r.statusCode).toBe(409);
    expect(r.body.error).toContain("New York Bricks");
    expect(m.prisma.opponentAlias.create).not.toHaveBeenCalled();
  });

  it("saves the normalised key, audits it, publishes the fixture and refreshes the schedule pages", async () => {
    const afterSave = new Map([...known, ["NY BRICKS", "New York Bricks"]]);
    m.aliases.mockResolvedValueOnce(known).mockResolvedValueOnce(afterSave);
    const r = res();
    await handler(req("POST", { scrapedName: "ny  bricks", displayName: " New York Bricks " }), r);
    expect(m.prisma.opponentAlias.create).toHaveBeenCalledWith({ data: { scrapedName: "NY BRICKS", displayName: "New York Bricks" } });
    expect(m.audit).toHaveBeenCalledWith("opponent_name_added", { ip: "1.2.3.4", scrapedName: "NY BRICKS", displayName: "New York Bricks" });
    expect(m.sync).toHaveBeenCalledWith([{ url: "u" }], afterSave);
    expect(m.sync.mock.calls[0][1].get("NY BRICKS")).toBe("New York Bricks");
    expect(m.invalidate).toHaveBeenCalledTimes(1);
    expect(r.statusCode).toBe(201);
    expect(r.body).toEqual({ ok: true, published: [{ opponent: "New York Bricks", scheduledFor: "2026-10-18T22:30:00.000Z" }], syncError: null });
  });

  it("keeps the name when the listing cannot be read, and says so", async () => {
    m.discover.mockResolvedValue({ games: [], fixtures: [], errors: ["Super League: Upstream unreachable: fetch failed"] });
    m.sync.mockResolvedValue({ created: [], changed: [], unmapped: [], skipped: [] });
    const r = res();
    await handler(req("POST", { scrapedName: "NY BRICKS", displayName: "New York Bricks" }), r);
    expect(m.prisma.opponentAlias.create).toHaveBeenCalled();
    expect(m.invalidate).not.toHaveBeenCalled();
    expect(r.statusCode).toBe(201);
    expect(r.body).toEqual({ ok: true, published: [], syncError: "Super League: Upstream unreachable: fetch failed" });
  });

  it("keeps the name and hides the raw error when publishing throws", async () => {
    m.discover.mockRejectedValue(new Error("connection terminated unexpectedly at pool.ts:42"));
    const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
    const r = res();
    await handler(req("POST", { scrapedName: "NY BRICKS", displayName: "New York Bricks" }), r);
    expect(m.prisma.opponentAlias.create).toHaveBeenCalled();
    expect(r.statusCode).toBe(201);
    expect(r.body.syncError).toBe("unexpected error while publishing");
    expect(quiet).toHaveBeenCalled();
    quiet.mockRestore();
  });
});
