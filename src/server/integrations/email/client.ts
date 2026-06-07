import "@/server/_internal/node-only";
import crypto       from "node:crypto";
import nodemailer   from "nodemailer";
import { auditLog } from "@/server/security/node/audit-log";
import prisma       from "@/server/db/client";
import {
  buildHtml,
  buildText,
  buildImportSuccess,
  buildImportFailure,
  buildGameImportedHtml,
  buildGameImportedText,
  buildConfirmationEmailHtml,
  buildConfirmationEmailText,
  renderMarkdown,
  buildBroadcastHtml,
  buildBroadcastText,
  type SendRosterAnnouncementParams,
  type GameImportedGame,
  type TopPerformer,
  type GameEmailContext,
} from "./templates";

export type ImportNotificationPayload =
  | { kind: "success"; opponent: string; location: string; scheduledFor: string; importedAt: Date }
  | { kind: "failure"; opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null; matchReason?: string | null };

const FROM = "Armani Katehano <noreply@armani-katehano.com>";

function createTransport(): nodemailer.Transporter | null {
  const user = process.env.BREVO_SMTP_USER;
  const pass = process.env.BREVO_SMTP_PASS;
  if (!user || !pass) return null;
  return nodemailer.createTransport({
    host: "smtp-relay.brevo.com",
    port: 587,
    secure: false,
    auth: { user, pass },
  });
}

export async function sendConfirmationEmail({
  email,
  confirmToken,
}: {
  email: string;
  confirmToken: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set - skipping confirmation email");
    return;
  }

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const confirmUrl = `${appUrl}/api/confirm?token=${confirmToken}`;
  const subject = "Confirm your subscription - Armani Katehano";
  const html    = buildConfirmationEmailHtml(confirmUrl, appUrl);
  const text    = buildConfirmationEmailText(confirmUrl, appUrl);

  const emailHash = crypto.createHash("sha256").update(email).digest("hex");
  try {
    await transport.sendMail({ from: FROM, to: email, subject, html, text });
    auditLog("confirmation_email_sent", { emailHash });
  } catch (err: any) {
    auditLog("confirmation_email_failed", { emailHash, error: err.message });
    throw err;
  }
}

export async function sendRosterAnnouncement({
  game,
  players,
  message,
  subscribers,
}: SendRosterAnnouncementParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set - skipping email send");
    return;
  }
  if (subscribers.length === 0) {
    auditLog("roster_emails_skipped", { reason: "no_confirmed_subscribers", opponent: game.opponent });
    return;
  }

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const isHome       = game.location === "home";
  const safeOpponent = game.opponent.slice(0, 100).replace(/[\r\n]/g, " ");
  const subject      = `Roster announced: ${isHome ? "vs" : "@"} ${safeOpponent}`;

  const results = await Promise.allSettled(
    subscribers.map(sub => {
      const emailHash      = crypto.createHash("sha256").update(sub.email).digest("hex");
      const unsubscribeUrl = `${appUrl}/unsubscribe?token=${sub.token}`;
      const html = buildHtml(game, players, message, appUrl, unsubscribeUrl);
      const text = buildText(game, players, message, appUrl, unsubscribeUrl);
      return transport.sendMail({ from: FROM, to: sub.email, subject, html, text })
        .then(() => {
          auditLog("roster_email_delivered", { emailHash, opponent: game.opponent });
          return prisma.subscriber.update({
            where: { id: sub.id },
            data:  { lastEmailedAt: new Date() },
          });
        })
        .catch((err: any) => {
          auditLog("roster_email_failed", { emailHash, error: err.message, opponent: game.opponent });
          throw err;
        });
    }),
  );

  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;

  auditLog("roster_emails_summary", {
    opponent:     game.opponent,
    total:        subscribers.length,
    sent,
    failed,
    allDelivered: failed === 0,
  });
}

export interface SendGameImportedBroadcastParams {
  game:          GameImportedGame;
  topPerformers: TopPerformer[];
  ctx:           GameEmailContext;
  subscribers:   Array<{ id: string; email: string; token: string }>;
}

export async function sendGameImportedBroadcast({
  game,
  topPerformers,
  ctx,
  subscribers,
}: SendGameImportedBroadcastParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set - skipping game-imported broadcast");
    return;
  }
  if (subscribers.length === 0) {
    auditLog("game_imported_emails_skipped", { reason: "no_confirmed_subscribers", gameId: game.id });
    return;
  }

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const vsAt         = game.location === "home" ? "vs" : "@";
  const safeOpponent = game.opponent.slice(0, 100).replace(/[\r\n]/g, " ");
  const subject      = `${vsAt} ${safeOpponent}: ${game.teamScore}-${game.opponentScore} (${game.result})`;

  const results = await Promise.allSettled(
    subscribers.map(sub => {
      const emailHash      = crypto.createHash("sha256").update(sub.email).digest("hex");
      const unsubscribeUrl = `${appUrl}/unsubscribe?token=${sub.token}`;
      const html = buildGameImportedHtml(game, topPerformers, ctx, appUrl, unsubscribeUrl);
      const text = buildGameImportedText(game, topPerformers, ctx, appUrl, unsubscribeUrl);
      return transport.sendMail({ from: FROM, to: sub.email, subject, html, text })
        .then(() => {
          auditLog("game_imported_email_delivered", { emailHash, gameId: game.id });
          return prisma.subscriber.update({ where: { id: sub.id }, data: { lastEmailedAt: new Date() } });
        })
        .catch((err: any) => {
          auditLog("game_imported_email_failed", { emailHash, error: err.message, gameId: game.id });
          throw err;
        });
    }),
  );

  const sent   = results.filter(r => r.status === "fulfilled").length;
  const failed = results.filter(r => r.status === "rejected").length;
  auditLog("game_imported_emails_summary", {
    gameId:        game.id,
    total:         subscribers.length,
    sent,
    failed,
    allDelivered:  failed === 0,
  });
}

export async function sendRosterAnnouncementTestEmail({
  to,
  game,
  players,
  message = null,
}: {
  to:      string;
  game:    import("./templates").Game;
  players: import("./templates").PlayerSlot[];
  message?: string | null;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) throw new Error("BREVO_SMTP_USER/PASS not configured");

  const appUrl             = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const previewUnsubscribe = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;
  const isHome             = game.location === "home";
  const safeOpponent       = game.opponent.slice(0, 100).replace(/[\r\n]/g, " ");
  const subject            = `Roster announced: ${isHome ? "vs" : "@"} ${safeOpponent}`;
  const html               = buildHtml(game, players, message, appUrl, previewUnsubscribe);
  const text               = buildText(game, players, message, appUrl, previewUnsubscribe);

  await transport.sendMail({ from: FROM, to, subject, html, text });
}

export async function sendConfirmationTestEmail({ to }: { to: string }): Promise<void> {
  const transport = createTransport();
  if (!transport) throw new Error("BREVO_SMTP_USER/PASS not configured");

  const appUrl     = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const confirmUrl = `${appUrl}/api/confirm?token=PREVIEW_TOKEN`;
  const subject    = "Confirm your subscription - Armani Katehano";
  const html       = buildConfirmationEmailHtml(confirmUrl, appUrl);
  const text       = buildConfirmationEmailText(confirmUrl, appUrl);

  await transport.sendMail({ from: FROM, to, subject, html, text });
}

export async function sendGameImportedTestEmail({
  to,
  game,
  topPerformers,
  ctx = { teamStats: null, record: null, nextGame: null },
}: {
  to:            string;
  game:          GameImportedGame;
  topPerformers: TopPerformer[];
  ctx?:          GameEmailContext;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) throw new Error("BREVO_SMTP_USER/PASS not configured");

  const appUrl             = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const previewUnsubscribe = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;
  const vsAt               = game.location === "home" ? "vs" : "@";
  const safeOpponent       = game.opponent.slice(0, 100).replace(/[\r\n]/g, " ");
  const subject            = `${vsAt} ${safeOpponent}: ${game.teamScore}-${game.opponentScore} (${game.result})`;
  const html               = buildGameImportedHtml(game, topPerformers, ctx, appUrl, previewUnsubscribe);
  const text               = buildGameImportedText(game, topPerformers, ctx, appUrl, previewUnsubscribe);

  await transport.sendMail({ from: FROM, to, subject, html, text });
}

export async function sendAdminAlert({
  subject,
  body,
}: {
  subject: string;
  body: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set - skipping admin alert");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  try {
    await transport.sendMail({ from: FROM, to, subject, text: body });
    auditLog("admin_alert_sent", { subject });
  } catch (err: any) {
    auditLog("admin_alert_failed", { subject, error: err.message });
  }
}

export async function sendImportNotification(payload: ImportNotificationPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set - skipping import notification");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";

  const result = payload.kind === "success" ? buildImportSuccess(payload) : buildImportFailure(payload);

  try {
    await transport.sendMail({ from: FROM, to, subject: result.subject, html: result.html, text: result.text });
    auditLog("import_notification_sent", { kind: payload.kind });
  } catch (err: any) {
    auditLog("import_notification_failed", { kind: payload.kind, error: err.message });
  }
}

export async function sendBroadcastTestEmail({
  to,
  subject,
  body,
}: {
  to:      string;
  subject: string;
  body:    string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) throw new Error("BREVO_SMTP_USER/PASS not configured");

  const appUrl       = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const fakeUnsub    = `${appUrl}/unsubscribe?token=PREVIEW_TOKEN`;
  const renderedHtml = renderMarkdown(body);
  const html         = buildBroadcastHtml(renderedHtml, appUrl, fakeUnsub);
  const text         = buildBroadcastText(renderedHtml, appUrl, fakeUnsub);
  const safeSubject  = subject.replace(/[\r\n]/g, " ");

  await transport.sendMail({ from: FROM, to, subject: safeSubject, html, text });
}

export type { SendRosterAnnouncementParams, PlayerSlot, Game, Subscriber } from "./templates";
