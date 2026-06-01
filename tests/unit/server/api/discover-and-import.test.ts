// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    upcomingGame: {
      findMany: vi.fn(),
      update:   vi.fn(),
    },
    gameImportJob: {
      create:            vi.fn(),
      update:            vi.fn(),
      findUniqueOrThrow: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client",                       () => ({ default: mockPrisma }));
vi.mock("@/server/services/import-job",             () => ({ processJob: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/services/discover-source-url",    () => ({
  discoverSourceUrl:  vi.fn(),
  ListingFetchError: class ListingFetchError extends Error {
    constructor(msg: string, public status: number) { super(msg); this.name = "ListingFetchError"; }
  },
}));
vi.mock("@/server/integrations/email/client",       () => ({ sendImportNotification: vi.fn().mockResolvedValue(undefined) }));
vi.mock("@/server/security/edge",                   () => ({
  securityHeaders: () => ({ "X-Test": "1" }),
}));
vi.mock("@/server/security/node",                   () => ({
  auditLog:        vi.fn(),
}));
vi.mock("@/server/services/cron-run", () => ({
  startCronRun:  vi.fn().mockResolvedValue("run-test"),
  finishCronRun: vi.fn().mockResolvedValue(undefined),
}));

import handler from "../../../../pages/api/cron/discover-and-import";
import { processJob }            from "@/server/services/import-job";
import { discoverSourceUrl, ListingFetchError } from "@/server/services/discover-source-url";
import { sendImportNotification } from "@/server/integrations/email/client";

const HOUR = 60 * 60 * 1000;
const NOW  = new Date("2026-04-25T22:00:00Z");

function mockReq(overrides: Partial<{ method: string; headers: Record<string, string> }> = {}) {
  return {
    method:  overrides.method  ?? "GET",
    headers: overrides.headers ?? { authorization: "Bearer test-secret" },
  };
}

function mockRes() {
  const res: any = {
    statusCode: 0,
    body:       null,
    setHeader:  vi.fn(),
    status(code: number) { this.statusCode = code; return this; },
    json(body: any)      { this.body = body;       return this; },
  };
  return res;
}

function makeGame(overrides: Partial<{
  id:            string;
  opponent:      string;
  location:      string;
  scheduledFor:  Date;
  sourceUrl:     string | null;
  listingUrl:    string | null;
  importJob:     any | null;
}> = {}) {
  return {
    id:           overrides.id           ?? "game1",
    opponent:     overrides.opponent     ?? "Παναθηναϊκός",
    location:     overrides.location     ?? "home",
    scheduledFor: overrides.scheduledFor ?? new Date("2026-04-25T19:00:00Z"),
    sourceUrl:    "sourceUrl"  in overrides ? overrides.sourceUrl  : null,
    listingUrl:   "listingUrl" in overrides ? overrides.listingUrl : "https://basketcity.sportstats.gr/men/teamdetails/id/UUID",
    importJob:    overrides.importJob    ?? null,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  process.env.CRON_SECRET = "test-secret";
  mockPrisma.upcomingGame.findMany.mockResolvedValue([]);
  mockPrisma.upcomingGame.update.mockResolvedValue({});
  mockPrisma.gameImportJob.create.mockImplementation(({ data }: any) => ({
    id: "jobNew", state: data.state ?? "PENDING", attempts: data.attempts ?? 0, failureSentAt: null, ...data,
  }));
  mockPrisma.gameImportJob.update.mockImplementation(({ data }: any) => ({
    id: "jobUpd", state: data.state ?? "PENDING", attempts: data.attempts ?? 0, failureSentAt: null, ...data,
  }));
  mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue({ id: "any", state: "IMPORTED" });
});

describe("POST/PUT/DELETE rejected", () => {
  it("returns 405 for non-GET", async () => {
    const res = mockRes();
    await handler(mockReq({ method: "POST" }) as any, res as any);
    expect(res.statusCode).toBe(405);
  });
});

describe("auth", () => {
  it("returns 401 when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    const res = mockRes();
    await handler(mockReq() as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when Authorization header doesn't match", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer wrong" } }) as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("accepts the matching Bearer token", async () => {
    const res = mockRes();
    await handler(mockReq() as any, res as any);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ ok: true, candidates: 0 });
  });

  it("returns 401 when Authorization header is shorter than expected (no crash)", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "Bearer x" } }) as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("returns 401 when Authorization header is empty", async () => {
    const res = mockRes();
    await handler(mockReq({ headers: { authorization: "" } }) as any, res as any);
    expect(res.statusCode).toBe(401);
  });

  it("records a CronRun row on successful run", async () => {
    const { startCronRun, finishCronRun } = await import("@/server/services/cron-run");
    const res = mockRes();
    await handler(mockReq() as any, res as any);
    expect(vi.mocked(startCronRun)).toHaveBeenCalledWith("discover-and-import");
    expect(vi.mocked(finishCronRun)).toHaveBeenCalledWith(
      "run-test",
      expect.objectContaining({ ok: true, summary: expect.any(Object) })
    );
  });
});

describe("backoff timing", () => {
  it("skips a game whose first attempt isn't due yet (< T+1h)", async () => {
    // scheduledFor = NOW - 30min -> T+1h = NOW + 30min, not due
    const game = makeGame({ scheduledFor: new Date(NOW.getTime() - 30 * 60 * 1000) });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ candidates: 1, skipped: 1, discovered: 0 });
  });

  it("runs discovery on first attempt at exactly T+1h", async () => {
    const game = makeGame({ scheduledFor: new Date(NOW.getTime() - HOUR) });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "no row" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).toHaveBeenCalledTimes(1);
    expect(res.body).toMatchObject({ candidates: 1 });
  });

  it("does not run a 2nd attempt before T+2h", async () => {
    // 90 min after tip-off, attempts already 1 -> next due at +2h = NOW + 30min, not due
    const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 90 * 60 * 1000),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ skipped: 1 });
  });

  it("runs the 2nd attempt at T+2h", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "still no row" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).toHaveBeenCalledTimes(1);
  });

  it("does not run a 3rd attempt before T+3h", async () => {
    // 2.5h after tip-off, attempts=2 -> next due at +3h = NOW + 0.5h, not due yet
    const job  = { id: "jobA", state: "PENDING", attempts: 2, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 150 * 60 * 1000),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ skipped: 1 });
  });

  it("runs the 3rd attempt at T+3h", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 2, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 3 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "still no row" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).toHaveBeenCalledTimes(1);
  });

  it("does not run a 4th attempt before T+4h", async () => {
    // 3.5h after tip-off, attempts=3 -> next due at +4h = NOW + 0.5h, not due yet
    const job  = { id: "jobA", state: "PENDING", attempts: 3, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 210 * 60 * 1000),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ skipped: 1 });
  });

  it("runs the 4th attempt at T+4h", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 3, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 4 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "still no row" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).toHaveBeenCalledTimes(1);
  });

  it("skips a game that has already exhausted MAX_DISCOVERY_TRIES", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 4, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
  });

  it("skips an ABANDONED job outright", async () => {
    const job  = { id: "jobA", state: "ABANDONED", attempts: 2, failureSentAt: new Date() };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
  });

  it("skips a game with no listingUrl and no sourceUrl", async () => {
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
      listingUrl:   null,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ skipped: 1 });
  });

  it("logs an audit entry when a game has no listingUrl", async () => {
    const { auditLog } = await import("@/server/security/node");
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
      listingUrl:   null,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
      "discover_skip",
      expect.objectContaining({ reason: "no-listing-url", upcomingGameId: "game1" })
    );
  });

  it("logs an audit entry for an ERROR job with sourceUrl already set", async () => {
    const { auditLog } = await import("@/server/security/node");
    const job  = { id: "jobA", state: "ERROR", attempts: 3, failureSentAt: new Date() };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
      sourceUrl:    "https://basketcity.sportstats.gr/men/gamedetails/id/STUCK",
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
      "discover_skip",
      expect.objectContaining({ reason: "job-state-ERROR", upcomingGameId: "game1" })
    );
  });

  it("logs an audit entry when MAX_DISCOVERY_TRIES has been exhausted", async () => {
    const { auditLog } = await import("@/server/security/node");
    const job  = { id: "jobA", state: "PENDING", attempts: 4, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 5 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(vi.mocked(auditLog)).toHaveBeenCalledWith(
      "discover_skip",
      expect.objectContaining({ reason: "max-tries-exhausted", upcomingGameId: "game1" })
    );
  });
});

describe("discovery outcomes", () => {
  it("on miss, creates a PENDING job with attempts=1 and no email yet", async () => {
    const game = makeGame({ scheduledFor: new Date(NOW.getTime() - HOUR) });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "no row" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        upcomingGameId: "game1",
        state:          "PENDING",
        attempts:       1,
        sourceUrl:      null,
      }),
    }));
    expect(sendImportNotification).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ abandoned: 0 });
  });

  it("does not abandon on a 3rd miss - records PENDING with attempts=3", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 2, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 3 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "not yet" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "jobA" },
      data:  expect.objectContaining({ state: "PENDING", attempts: 3 }),
    }));
    expect(sendImportNotification).not.toHaveBeenCalled();
    expect(res.body).toMatchObject({ abandoned: 0 });
  });

  it("on 4th miss, marks ABANDONED and sends abandoned email", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 3, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 4 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "still nothing" });
    mockPrisma.gameImportJob.update.mockResolvedValueOnce({
      id: "jobA", state: "ABANDONED", attempts: 4, failureSentAt: null,
    });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "jobA" },
      data:  expect.objectContaining({ state: "ABANDONED", attempts: 4 }),
    }));
    expect(sendImportNotification).toHaveBeenCalledWith(expect.objectContaining({
      kind:     "abandoned",
      opponent: "Παναθηναϊκός",
      attempts: 4,
    }));
    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "jobA" },
      data:  expect.objectContaining({ failureSentAt: expect.any(Date) }),
    }));
    expect(res.body).toMatchObject({ abandoned: 1 });
  });

  it("does not re-send the abandoned email if failureSentAt is already set", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 3, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 4 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "still nothing" });
    mockPrisma.gameImportJob.update.mockResolvedValueOnce({
      id: "jobA", state: "ABANDONED", attempts: 4, failureSentAt: new Date(),
    });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(sendImportNotification).not.toHaveBeenCalled();
  });

  it("on a discovery hit, promotes sourceUrl, resets attempts, and runs processJob", async () => {
    const game = makeGame({ scheduledFor: new Date(NOW.getTime() - HOUR) });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    const FOUND = "https://basketcity.sportstats.gr/men/gamedetails/id/HIT";
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: FOUND, reason: "matched" });
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue({ id: "jobNew", state: "IMPORTED" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.upcomingGame.update).toHaveBeenCalledWith({
      where: { id: "game1" },
      data:  { sourceUrl: FOUND },
    });
    expect(mockPrisma.gameImportJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ upcomingGameId: "game1", sourceUrl: FOUND, state: "PENDING" }),
    }));
    expect(processJob).toHaveBeenCalledWith("jobNew");
    expect(res.body).toMatchObject({ discovered: 1, imported: 1 });
  });

  it("does not increment attempts on a transient ListingFetchError", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockRejectedValue(new ListingFetchError("upstream 502", 502));

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "jobA" },
      data:  expect.objectContaining({
        state:    "PENDING",
        attempts: 1,    // unchanged
        lastError: expect.stringContaining("upstream 502"),
      }),
    }));
  });

  it("increments attempts on a genuine miss (listing parsed OK, no row matched)", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 1, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - 2 * HOUR),
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockResolvedValue({ gameUrl: null, reason: "no row for that date" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "jobA" },
      data:  expect.objectContaining({ state: "PENDING", attempts: 2 }),
    }));
  });

  it("treats a ListingFetchError as a transient miss (does not increment attempts, does not throw)", async () => {
    const game = makeGame({ scheduledFor: new Date(NOW.getTime() - HOUR) });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    vi.mocked(discoverSourceUrl).mockRejectedValue(new ListingFetchError("upstream 500", 502));

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(mockPrisma.gameImportJob.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        state:     "PENDING",
        attempts:  0,   // transient: attempts unchanged (job was null -> job?.attempts ?? 0 = 0)
        lastError: expect.stringContaining("upstream 500"),
      }),
    }));
    expect(res.body).toMatchObject({ candidates: 1, errors: 0 });
  });
});

describe("sourceUrl already known", () => {
  it("skips discovery and runs processJob on an existing PENDING job", async () => {
    const job  = { id: "jobA", state: "PENDING", attempts: 0, failureSentAt: null };
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - HOUR),
      sourceUrl:    "https://basketcity.sportstats.gr/men/gamedetails/id/EXISTING",
      importJob:    job,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue({ id: "jobA", state: "IMPORTED" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(processJob).toHaveBeenCalledWith("jobA");
    expect(res.body).toMatchObject({ imported: 1 });
  });

  it("creates a PENDING job when sourceUrl is set but no job exists yet", async () => {
    const SRC  = "https://basketcity.sportstats.gr/men/gamedetails/id/EXISTING2";
    const game = makeGame({
      scheduledFor: new Date(NOW.getTime() - HOUR),
      sourceUrl:    SRC,
    });
    mockPrisma.upcomingGame.findMany.mockResolvedValue([game]);
    mockPrisma.gameImportJob.findUniqueOrThrow.mockResolvedValue({ id: "jobNew", state: "IMPORTED" });

    const res = mockRes();
    await handler(mockReq() as any, res as any);

    expect(discoverSourceUrl).not.toHaveBeenCalled();
    expect(mockPrisma.gameImportJob.create).toHaveBeenCalledWith({
      data: { upcomingGameId: "game1", sourceUrl: SRC, state: "PENDING" },
    });
    expect(processJob).toHaveBeenCalledWith("jobNew");
  });
});
