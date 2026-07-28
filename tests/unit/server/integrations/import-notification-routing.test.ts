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

  it("reports which channel carried the alert", async () => {
    mockSlack.mockResolvedValue(true);
    expect(await sendImportNotification(STALLED)).toBe("slack");
    mockSlack.mockResolvedValue(false);
    expect(await sendImportNotification(STALLED)).toBe("email");
  });

  it("reports none when neither channel is available", async () => {
    mockSlack.mockResolvedValue(false);
    delete process.env.BREVO_SMTP_USER;
    delete process.env.BREVO_SMTP_PASS;
    expect(await sendImportNotification(STALLED)).toBe("none");
    expect(mockSendMail).not.toHaveBeenCalled();
  });

  it("reports none when the mail transport throws", async () => {
    mockSlack.mockResolvedValue(false);
    mockSendMail.mockRejectedValue(new Error("smtp down"));
    expect(await sendImportNotification(STALLED)).toBe("none");
  });

  // A test must not be mistakable for a real import or a real failure: one
  // would look like a game arrived, the other would raise a false alarm.
  it("sends the test alert as its own kind, not a fake import or stall", async () => {
    mockSlack.mockResolvedValue(true);
    await sendImportNotification({ kind: "test" });
    const text = mockSlack.mock.calls[0][0];
    expect(text).toMatch(/Alert Path Test/);
    expect(text).toMatch(/No game was imported/);
    expect(text).not.toMatch(/Stuck|Imported:/);
  });
});
