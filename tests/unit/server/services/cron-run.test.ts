// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cronRun: {
      create:     vi.fn(),
      update:     vi.fn(),
      groupBy:    vi.fn(),
      deleteMany: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));

import { startCronRun, finishCronRun, cronFreshness, CRON_JOBS } from "@/server/services/cron-run";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.cronRun.create.mockResolvedValue({ id: "run1", job: "purge-subscribers", startedAt: new Date() });
  mockPrisma.cronRun.update.mockResolvedValue({});
  mockPrisma.cronRun.groupBy.mockResolvedValue([]);
});

describe("startCronRun", () => {
  it("creates a CronRun row and returns its id", async () => {
    const id = await startCronRun("purge-subscribers");
    expect(id).toBe("run1");
    expect(mockPrisma.cronRun.create).toHaveBeenCalledWith({
      data: { job: "purge-subscribers" },
    });
  });
});

describe("finishCronRun", () => {
  it("updates the row with ok=true, summary and finishedAt", async () => {
    await finishCronRun("run1", { ok: true, summary: { candidates: 3 } });
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run1" },
      data:  expect.objectContaining({
        ok: true,
        summary: { candidates: 3 },
        finishedAt: expect.any(Date),
        error: null,
      }),
    }));
  });

  it("updates the row with ok=false and an error message", async () => {
    await finishCronRun("run1", { ok: false, error: "boom" });
    expect(mockPrisma.cronRun.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: "run1" },
      data:  expect.objectContaining({ ok: false, error: "boom" }),
    }));
  });
});

describe("cronFreshness", () => {
  const hoursAgo = (h) => new Date(Date.now() - h * 60 * 60 * 1000);

  it("reports a job that has never run as stale rather than absent", async () => {
    mockPrisma.cronRun.groupBy.mockResolvedValue([]);

    const rows = await cronFreshness();

    expect(rows).toHaveLength(CRON_JOBS.length);
    expect(rows.every(r => r.stale)).toBe(true);
    expect(rows.every(r => r.lastOkAt === null)).toBe(true);
  });

  it("treats a run inside the 26h window as fresh", async () => {
    mockPrisma.cronRun.groupBy.mockResolvedValue([
      { job: "purgeAuditLog", _max: { finishedAt: hoursAgo(25) } },
    ]);

    const row = (await cronFreshness()).find(r => r.job === "purgeAuditLog");
    expect(row.stale).toBe(false);
  });

  it("treats a run older than the 26h window as stale", async () => {
    mockPrisma.cronRun.groupBy.mockResolvedValue([
      { job: "purgeAuditLog", _max: { finishedAt: hoursAgo(27) } },
    ]);

    const row = (await cronFreshness()).find(r => r.job === "purgeAuditLog");
    expect(row.stale).toBe(true);
  });

  it("only counts successful runs", async () => {
    await cronFreshness();
    expect(mockPrisma.cronRun.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({ where: { ok: true } }),
    );
  });
});
