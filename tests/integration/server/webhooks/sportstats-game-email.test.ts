// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";
import crypto from "crypto";
import { Readable } from "stream";

// --- Hoisted mocks ---
const { mockPrisma, mockMatchUpcomingGame, mockProcessJob, mockSendAdminAlert, mockSendImportNotification } = vi.hoisted(() => ({
  mockPrisma: {
    gameImportJob: { create: vi.fn() },
  },
  mockMatchUpcomingGame:       vi.fn(),
  mockProcessJob:              vi.fn(),
  mockSendAdminAlert:          vi.fn(),
  mockSendImportNotification:  vi.fn(),
}));

vi.mock("@/server/db/client",                        () => ({ default: mockPrisma }));
vi.mock("@/server/services/match-upcoming-game",     () => ({ matchUpcomingGame: mockMatchUpcomingGame }));
vi.mock("@/server/services/import-job",              () => ({ processJob: mockProcessJob }));
vi.mock("@/server/integrations/email/client",        () => ({
  sendAdminAlert:         mockSendAdminAlert,
  sendImportNotification: mockSendImportNotification,
}));
vi.mock("@/server/security/audit-log",               () => ({ auditLog: vi.fn() }));
vi.mock("@/server/security/client-ip",               () => ({ getClientIp: () => "3.134.147.250" }));

import handler from "../../../../pages/api/webhooks/sportstats-game-email";

// ---------------------------------------------------------------------------

const WEBHOOK_SECRET = "test-secret-value";

const SAMPLE_PAYLOAD = {
  From:     "info@sportstats.gr",
  FromFull: { Email: "info@sportstats.gr", Name: "SportStats", MailboxHash: "" },
  Subject:  "ARMANI KATEHANO - ΑΡΗΣ (2025/01/15)",
  TextBody: "Game ended.",
  HtmlBody: "<p>Game ended.</p>",
};

function makeRequest(body: string, headers: Record<string, string> = {}): any {
  const sig = "sha256=" + crypto.createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex");
  const readable = Readable.from([Buffer.from(body)]);
  (readable as any).method  = "POST";
  (readable as any).headers = {
    "x-postmark-signature-256": sig,
    "content-type": "application/json",
    ...headers,
  };
  return readable;
}

function makeResponse(): any {
  const res = {
    statusCode:  200,
    _headers:    {} as Record<string, string>,
    _body:       "",
    writeHead(code: number, hdrs?: any) { this.statusCode = code; if (hdrs) Object.assign(this._headers, hdrs); },
    end(body?: string)                  { this._body = body ?? ""; },
  };
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
  process.env.POSTMARK_WEBHOOK_SECRET = WEBHOOK_SECRET;
  mockProcessJob.mockResolvedValue(undefined);
  mockSendAdminAlert.mockResolvedValue(undefined);
  mockSendImportNotification.mockResolvedValue(undefined);
  mockPrisma.gameImportJob.create.mockResolvedValue({ id: "job1", state: "PENDING" });
});

// ---------------------------------------------------------------------------

describe("sportstats-game-email webhook", () => {
  it("triggers import when match found with sourceUrl", async () => {
    const match = {
      id:         "ug1",
      opponent:   "ΑΡΗΣ",
      scheduledFor: new Date("2025-01-15T18:00:00Z"),
      sourceUrl:  "https://basketcity.sportstats.gr/game/99",
      importJobs: [],
    };
    mockMatchUpcomingGame.mockResolvedValue(match);

    const body = JSON.stringify(SAMPLE_PAYLOAD);
    const req  = makeRequest(body);
    const res  = makeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.gameImportJob.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ upcomingGameId: "ug1" }) })
    );
    // processJob is asynchronous; allow microtask to flush
    await Promise.resolve();
    expect(mockProcessJob).toHaveBeenCalledWith("job1");
    expect(mockSendAdminAlert).not.toHaveBeenCalled();
  });

  it("skips processJob and returns 200 when job already IMPORTED", async () => {
    const match = {
      id:          "ug2",
      opponent:    "ΑΡΗΣ",
      scheduledFor: new Date("2025-01-15T18:00:00Z"),
      sourceUrl:   "https://basketcity.sportstats.gr/game/99",
      importJobs:  [{ id: "job2", state: "IMPORTED" }],
    };
    mockMatchUpcomingGame.mockResolvedValue(match);

    const res = makeResponse();
    await handler(makeRequest(JSON.stringify(SAMPLE_PAYLOAD)), res);

    expect(res.statusCode).toBe(200);
    await Promise.resolve();
    expect(mockProcessJob).not.toHaveBeenCalled();
  });

  it("sends admin alert and returns 200 when no matching upcoming game", async () => {
    mockMatchUpcomingGame.mockResolvedValue(null);

    const res = makeResponse();
    await handler(makeRequest(JSON.stringify(SAMPLE_PAYLOAD)), res);

    expect(res.statusCode).toBe(200);
    expect(mockSendImportNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "no-match" })
    );
    expect(mockProcessJob).not.toHaveBeenCalled();
  });

  it("sends admin alert and returns 200 when match found but sourceUrl missing", async () => {
    const match = {
      id:          "ug3",
      opponent:    "ΑΡΗΣ",
      location:    "home",
      scheduledFor: new Date("2025-01-15T18:00:00Z"),
      sourceUrl:   null,
      importJobs:  [],
    };
    mockMatchUpcomingGame.mockResolvedValue(match);

    const res = makeResponse();
    await handler(makeRequest(JSON.stringify(SAMPLE_PAYLOAD)), res);

    expect(res.statusCode).toBe(200);
    expect(mockSendImportNotification).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "no-source-url" })
    );
  });

  it("returns 401 when HMAC is wrong", async () => {
    const body = JSON.stringify(SAMPLE_PAYLOAD);
    const req  = makeRequest(body, { "x-postmark-signature-256": "sha256=badhash" });
    const res  = makeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(401);
    expect(mockProcessJob).not.toHaveBeenCalled();
  });

  it("returns 200 silently for non-sportstats sender (HMAC passes)", async () => {
    const otherPayload = { ...SAMPLE_PAYLOAD, From: "other@example.com", FromFull: { Email: "other@example.com" } };
    const body = JSON.stringify(otherPayload);
    const req  = makeRequest(body);
    const res  = makeResponse();

    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(mockMatchUpcomingGame).not.toHaveBeenCalled();
    expect(mockSendAdminAlert).not.toHaveBeenCalled();
  });

  it("sends admin alert when subject cannot be parsed", async () => {
    const badPayload = { ...SAMPLE_PAYLOAD, Subject: "Monthly newsletter -- February 2025" };
    const body = JSON.stringify(badPayload);
    const res  = makeResponse();

    await handler(makeRequest(body), res);

    expect(res.statusCode).toBe(200);
    expect(mockSendAdminAlert).toHaveBeenCalledWith(
      expect.objectContaining({ subject: expect.stringContaining("subject could not be parsed") })
    );
    expect(mockMatchUpcomingGame).not.toHaveBeenCalled();
  });

  it("returns 200 and reuses existing PENDING job without creating a new one", async () => {
    const existingJob = { id: "job-existing", state: "PENDING" };
    const match = {
      id:          "ug4",
      opponent:    "ΑΡΗΣ",
      scheduledFor: new Date("2025-01-15T18:00:00Z"),
      sourceUrl:   "https://basketcity.sportstats.gr/game/99",
      importJobs:  [existingJob],
    };
    mockMatchUpcomingGame.mockResolvedValue(match);

    const res = makeResponse();
    await handler(makeRequest(JSON.stringify(SAMPLE_PAYLOAD)), res);

    expect(res.statusCode).toBe(200);
    expect(mockPrisma.gameImportJob.create).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(mockProcessJob).toHaveBeenCalledWith("job-existing");
  });
});
