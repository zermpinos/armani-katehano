import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("nodemailer", () => ({
  default: { createTransport: vi.fn() },
}));
vi.mock("@/server/db/client", () => ({
  default: { subscriber: { update: vi.fn().mockResolvedValue({}) } },
}));
vi.mock("@/server/security/node/audit-log", () => ({
  auditLog: vi.fn(),
}));

import nodemailer from "nodemailer";
import prisma from "@/server/db/client";
import { auditLog } from "@/server/security/node/audit-log";
import { sendGameImportedBroadcast, sendCourtesySubscriberEmail, sendCourtesyTestEmail } from "@/server/integrations/email/client";

const game = {
  id:            "game_xyz",
  opponent:      "Olympiacos B",
  location:      "home",
  teamScore:     78,
  opponentScore: 73,
  result:        "W",
  playedOn:      new Date("2026-05-15T19:00:00Z"),
  venueNote:     null,
};
const top = [
  { number: 11, name: "Alex P", pts: 24, reb: 7, ast: 5 },
  { number: 7,  name: "Niko I",  pts: 18, reb: 4, ast: 3 },
  { number: 4,  name: "Yannis K",pts: 12, reb: 10, ast: 2 },
];

beforeEach(() => {
  vi.clearAllMocks();
  process.env.BREVO_SMTP_USER     = "user";
  process.env.BREVO_SMTP_PASS     = "pass";
  process.env.NEXT_PUBLIC_APP_URL = "https://armani-katehano.com";
});

describe("sendGameImportedBroadcast", () => {
  it("sends to every confirmed subscriber and updates lastEmailedAt", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    const subs = [
      { id: "s1", email: "a@x.com", token: "tk1" },
      { id: "s2", email: "b@x.com", token: "tk2" },
    ];
    await sendGameImportedBroadcast({ game, topPerformers: top, subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(prisma.subscriber.update).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith("game_imported_emails_summary", expect.objectContaining({ total: 2, sent: 2, failed: 0 }));
  });

  it("skips with audit log when subscriber list is empty", async () => {
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendGameImportedBroadcast({ game, topPerformers: top, subscribers: [] });

    expect(sendMail).not.toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith("game_imported_emails_skipped", expect.objectContaining({ reason: "no_confirmed_subscribers" }));
  });

  it("continues after one recipient failure and records sent/failed counts", async () => {
    const sendMail = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("smtp blew up"));
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    const subs = [
      { id: "s1", email: "a@x.com", token: "tk1" },
      { id: "s2", email: "b@x.com", token: "tk2" },
    ];
    await sendGameImportedBroadcast({ game, topPerformers: top, subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith("game_imported_emails_summary", expect.objectContaining({ total: 2, sent: 1, failed: 1 }));
  });

  it("no-ops when transport env is missing", async () => {
    delete process.env.BREVO_SMTP_USER;
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue(null);

    await sendGameImportedBroadcast({ game, topPerformers: top, subscribers: [{ id: "s1", email: "a@x.com", token: "tk1" }] });

    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("sendCourtesySubscriberEmail", () => {
  it("sends to every confirmed subscriber, updates lastEmailedAt, writes summary", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    const subs = [
      { id: "s1", email: "a@x.com", token: "tk1" },
      { id: "s2", email: "b@x.com", token: "tk2" },
    ];
    const result = await sendCourtesySubscriberEmail({ subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(prisma.subscriber.update).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith(
      "courtesy_emails_summary",
      expect.objectContaining({ total: 2, sent: 2, failed: 0 }),
    );
    expect(result).toEqual({ total: 2, sent: 2, failed: 0 });
  });

  it("skips with audit log when subscriber list is empty", async () => {
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    const result = await sendCourtesySubscriberEmail({ subscribers: [] });

    expect(sendMail).not.toHaveBeenCalled();
    expect(auditLog).toHaveBeenCalledWith(
      "courtesy_emails_skipped",
      expect.objectContaining({ reason: "no_confirmed_subscribers" }),
    );
    expect(result).toEqual({ total: 0, sent: 0, failed: 0 });
  });

  it("continues after one recipient failure and records sent/failed counts", async () => {
    const sendMail = vi.fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("smtp blew up"));
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    const subs = [
      { id: "s1", email: "a@x.com", token: "tk1" },
      { id: "s2", email: "b@x.com", token: "tk2" },
    ];
    const result = await sendCourtesySubscriberEmail({ subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith(
      "courtesy_emails_summary",
      expect.objectContaining({ total: 2, sent: 1, failed: 1 }),
    );
    expect(result).toEqual({ total: 2, sent: 1, failed: 1 });
  });

  it("no-ops when transport env is missing", async () => {
    delete process.env.BREVO_SMTP_USER;
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue(null);

    const result = await sendCourtesySubscriberEmail({
      subscribers: [{ id: "s1", email: "a@x.com", token: "tk1" }],
    });

    expect(sendMail).not.toHaveBeenCalled();
    expect(result).toEqual({ total: 0, sent: 0, failed: 0 });
  });
});

describe("sendCourtesyTestEmail", () => {
  it("sends a single email and writes nothing to the audit log", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendCourtesyTestEmail({ to: "operator@example.com" });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "operator@example.com" }),
    );
    expect(auditLog).not.toHaveBeenCalled();
    expect(prisma.subscriber.update).not.toHaveBeenCalled();
  });

  it("uses PREVIEW_TOKEN in the rendered unsubscribe URL", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendCourtesyTestEmail({ to: "operator@example.com" });

    const arg = sendMail.mock.calls[0][0];
    expect(arg.html).toContain("token=PREVIEW_TOKEN");
    expect(arg.text).toContain("token=PREVIEW_TOKEN");
  });

  it("throws when transport env is missing", async () => {
    delete process.env.BREVO_SMTP_USER;
    (nodemailer.createTransport as any).mockReturnValue(null);

    await expect(
      sendCourtesyTestEmail({ to: "operator@example.com" }),
    ).rejects.toThrow(/BREVO/);
  });
});
