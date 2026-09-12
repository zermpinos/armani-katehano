// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockPrisma, mockSendAdminAlert } = vi.hoisted(() => ({
  mockPrisma: {
    auditLog: {
      count:  vi.fn(),
      create: vi.fn(),
    },
  },
  mockSendAdminAlert: vi.fn(),
}));

vi.mock("@/server/db/client", () => ({ default: mockPrisma }));
vi.mock("@/server/_internal/node-only", () => ({}));
vi.mock("@/server/integrations/email/client", () => ({ sendAdminAlert: mockSendAdminAlert }));

import { dispatchSecurityAlert } from "@/server/services/security-alert";

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.auditLog.create.mockResolvedValue({});
  mockSendAdminAlert.mockResolvedValue("slack");
});

describe("dispatchSecurityAlert", () => {
  it("sends when no marker exists in the window and records the delivery", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0);

    const sent = await dispatchSecurityAlert("login_account_locked", { ip: "abc" });

    expect(sent).toBe(true);
    expect(mockSendAdminAlert).toHaveBeenCalledOnce();
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: { event: "security_alert_sent", data: { for: "login_account_locked", via: "slack" } },
    });
  });

  it("suppresses a repeat while a marker for the same event is inside the window", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(1);

    const sent = await dispatchSecurityAlert("login_account_locked", { ip: "abc" });

    expect(sent).toBe(false);
    expect(mockSendAdminAlert).not.toHaveBeenCalled();
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });

  it("debounces per event, so a different event is not suppressed by the first", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0);
    await dispatchSecurityAlert("csrf_blocked", {});

    const where = mockPrisma.auditLog.count.mock.calls[0][0].where;
    expect(where.event).toBe("security_alert_sent");
    expect(where.data).toEqual({ path: ["for"], equals: "csrf_blocked" });
  });

  it("still records the marker when delivery fails, so a dead channel is not hammered", async () => {
    mockPrisma.auditLog.count.mockResolvedValue(0);
    mockSendAdminAlert.mockResolvedValue("none");

    const sent = await dispatchSecurityAlert("broadcast_invalid_token", {});

    expect(sent).toBe(false);
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: { event: "security_alert_sent", data: { for: "broadcast_invalid_token", via: "none" } },
    });
  });
});
