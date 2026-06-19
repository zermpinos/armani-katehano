// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

vi.hoisted(() => {
  process.env.SESSION_SECRET = "test-secret-admin-integration";
});

const { mockPrisma } = vi.hoisted(() => {
  const mp = {
    setting: {
      findMany:   vi.fn(),
      upsert:     vi.fn(),
      findUnique: vi.fn(),
    },
    auditLog: { create: vi.fn().mockResolvedValue(undefined) },
  };
  return { mockPrisma: mp };
});

vi.mock("@/server/db/client", () => ({ default: mockPrisma, prisma: mockPrisma }));
vi.mock("@/server/services/cache-invalidation", () => ({
  invalidateForPopupConfig: vi.fn().mockResolvedValue(undefined),
}));

import { invalidateForPopupConfig } from "@/server/services/cache-invalidation";
import handler from "../../../../pages/api/admin/popup-config";
import { authedReq, mockResWithRevalidate } from "../db/__support__/games-admin-mocks";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.setting.findUnique.mockResolvedValue(null);
  mockPrisma.setting.upsert.mockResolvedValue({ key: "popupEnabled", value: "true" });
});

describe("popup-config ISR revalidation", () => {
  it("POST { enabled } calls invalidateForPopupConfig with res.revalidate", async () => {
    const req = authedReq({ method: "POST", body: { enabled: true } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(invalidateForPopupConfig).toHaveBeenCalledWith({ revalidate: res.revalidate });
  });

  it("POST { round } calls invalidateForPopupConfig", async () => {
    const req = authedReq({ method: "POST", body: { round: "final" } });
    const res = mockResWithRevalidate();
    await handler(req, res);
    expect(invalidateForPopupConfig).toHaveBeenCalled();
  });
});
