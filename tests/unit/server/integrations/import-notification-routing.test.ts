// @ts-nocheck
import { vi, describe, it, expect, beforeEach } from "vitest";

const { mockSendMail, mockSlack } = vi.hoisted(() => ({
  mockSendMail: vi.fn().mockResolvedValue({}),
  mockSlack:    vi.fn(),
}));

vi.mock("nodemailer", () => ({
  default: { createTransport: () => ({ sendMail: mockSendMail }) },
}));
vi.mock("@/server/integrations/slack/client", () => ({ sendSlackAlert: mockSlack }));
vi.mock("@/server/security/node/audit-log", () => ({ auditLog: vi.fn() }));
vi.mock("@/server/db/client", () => ({ default: {}, prisma: {} }));

import { sendImportNotification } from "@/server/integrations/email/client";

const STALLED = {
  kind: "stalled",
  entries: [{ sourceUrl: "https://example.com/game/1", reason: "league unresolved" }],
};

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BREVO_SMTP_USER = "user";
  process.env.BREVO_SMTP_PASS = "pass";
  mockSendMail.mockResolvedValue({});
});

describe("sendImportNotification delivery", () => {
  it("sends to Slack and skips email when Slack accepts", async () => {
    mockSlack.mockResolvedValue(true);
    await sendImportNotification(STALLED);
    expect(mockSlack).toHaveBeenCalledOnce();
    expect(mockSlack.mock.calls[0][0]).toMatch(/league unresolved/);
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  // An alert that cannot reach Slack must not be dropped, since the whole point
  // of the poll is that nobody is watching it run.
  it("falls back to email when Slack is unset or fails", async () => {
    mockSlack.mockResolvedValue(false);
    await sendImportNotification(STALLED);
    expect(mockSendMail).toHaveBeenCalledOnce();
    expect(mockSendMail.mock.calls[0][0].text).toMatch(/league unresolved/);
  });
});
