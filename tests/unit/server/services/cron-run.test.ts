// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    cronRun: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));

import { startCronRun, finishCronRun } from "@/server/services/cron-run";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.cronRun.create.mockResolvedValue({ id: "run1", job: "purge-subscribers", startedAt: new Date() });
  mockPrisma.cronRun.update.mockResolvedValue({});
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
