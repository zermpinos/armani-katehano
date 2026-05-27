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
import { sendGameImportedBroadcast, sendConfirmationEmail } from "@/server/integrations/email/client";

const game = {
  id:            "game_xyz",
  opponent:      "Olympiacos B",
  location:      "home",
  teamScore:     78,
  opponentScore: 73,
  result:        "W",
  playedOn:      new Date("2026-05-15T19:00:00Z"),
  venueNote:     null,
  competition:   "A2 League",
};
const top = [
  { number: 11, name: "Alex P",   position: "Guard",   photoUrl: null, pts: 24, reb: 7,  ast: 5 },
  { number: 7,  name: "Niko I",   position: "Forward", photoUrl: null, pts: 18, reb: 4,  ast: 3 },
  { number: 4,  name: "Yannis K", position: "Center",  photoUrl: null, pts: 12, reb: 10, ast: 2 },
];

const ctx = {
  teamStats: null,
  record:    null,
  nextGame:  null,
};

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
    await sendGameImportedBroadcast({ game, topPerformers: top, ctx, subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(prisma.subscriber.update).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith("game_imported_emails_summary", expect.objectContaining({ total: 2, sent: 2, failed: 0 }));
  });

  it("skips with audit log when subscriber list is empty", async () => {
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendGameImportedBroadcast({ game, topPerformers: top, ctx, subscribers: [] });

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
    await sendGameImportedBroadcast({ game, topPerformers: top, ctx, subscribers: subs });

    expect(sendMail).toHaveBeenCalledTimes(2);
    expect(auditLog).toHaveBeenCalledWith("game_imported_emails_summary", expect.objectContaining({ total: 2, sent: 1, failed: 1 }));
  });

  it("no-ops when transport env is missing", async () => {
    delete process.env.BREVO_SMTP_USER;
    const sendMail = vi.fn();
    (nodemailer.createTransport as any).mockReturnValue(null);

    await sendGameImportedBroadcast({ game, topPerformers: top, ctx, subscribers: [{ id: "s1", email: "a@x.com", token: "tk1" }] });

    expect(sendMail).not.toHaveBeenCalled();
  });
});

describe("sendConfirmationEmail", () => {
  it("sends mail and logs confirmation_email_sent", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendConfirmationEmail({ email: "user@example.com", confirmToken: "c".repeat(64) });

    expect(sendMail).toHaveBeenCalledOnce();
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@example.com" }),
    );
    expect(auditLog).toHaveBeenCalledWith(
      "confirmation_email_sent",
      expect.objectContaining({ emailHash: expect.any(String) }),
    );
  });

  it("builds the confirm URL from confirmToken -- URL appears in html and text", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await sendConfirmationEmail({ email: "user@example.com", confirmToken: "c".repeat(64) });

    const arg = sendMail.mock.calls[0][0];
    expect(arg.html).toContain(`token=${"c".repeat(64)}`);
    expect(arg.text).toContain(`token=${"c".repeat(64)}`);
  });

  it("does NOT accept a confirmUrl parameter -- URL must be built from confirmToken only", async () => {
    const sendMail = vi.fn().mockResolvedValue({});
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    // Passing a confirmUrl alongside confirmToken should have no effect on the URL --
    // the function does not accept confirmUrl in its interface.
    await (sendConfirmationEmail as any)({
      email: "user@example.com",
      confirmToken: "d".repeat(64),
      confirmUrl: "https://evil.com/hijack",
    });

    const arg = sendMail.mock.calls[0][0];
    expect(arg.html).not.toContain("https://evil.com");
    expect(arg.html).toContain(`token=${"d".repeat(64)}`);
  });

  it("no-ops and returns void when SMTP transport is not configured", async () => {
    delete process.env.BREVO_SMTP_USER;
    (nodemailer.createTransport as any).mockReturnValue(null);

    await expect(
      sendConfirmationEmail({ email: "user@example.com", confirmToken: "c".repeat(64) }),
    ).resolves.toBeUndefined();

    expect(auditLog).not.toHaveBeenCalled();
  });

  it("throws and logs confirmation_email_failed when SMTP rejects", async () => {
    const sendMail = vi.fn().mockRejectedValue(new Error("connection refused"));
    (nodemailer.createTransport as any).mockReturnValue({ sendMail });

    await expect(
      sendConfirmationEmail({ email: "user@example.com", confirmToken: "c".repeat(64) }),
    ).rejects.toThrow("connection refused");

    expect(auditLog).toHaveBeenCalledWith(
      "confirmation_email_failed",
      expect.objectContaining({ error: "connection refused" }),
    );
  });
});

