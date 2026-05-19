import "@/server/_internal/node-only";
import crypto       from "node:crypto";
import nodemailer   from "nodemailer";
import { auditLog } from "@/server/security/node/audit-log";
import prisma       from "@/server/db/client";
import {
  esc,
  buildHtml,
  buildText,
  buildImportSuccess,
  buildImportFailure,
  buildImportAbandoned,
  buildImportHeartbeat,
  buildGameImportedHtml,
  buildGameImportedText,
  type SendRosterAnnouncementParams,
  type HeartbeatPayload,
  type GameImportedGame,
  type TopPerformer,
} from "./templates";

export type ImportNotificationPayload =
  | { kind: "success";   opponent: string; location: string; scheduledFor: string; importedAt: Date; broadcastLink?: string }
  | { kind: "failure";   opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null; matchReason?: string | null }
  | { kind: "abandoned"; opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null; matchReason?: string | null };

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
  confirmUrl,
}: {
  email: string;
  confirmUrl: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping confirmation email");
    return;
  }

  const subject = "Confirm your subscription -- Armani Katehano";
  const safeUrl = esc(confirmUrl);
  const html = `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
<html xmlns="http://www.w3.org/1999/xhtml" lang="el">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Confirm your subscription</title>
</head>
<body style="margin:0;padding:0;background-color:#f3f4f6;-webkit-font-smoothing:antialiased;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0"
         style="background-color:#f3f4f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:480px;background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">
          <tr>
            <td style="background:#111111;padding:28px 32px;">
              <p style="margin:0;font-size:10px;font-weight:700;letter-spacing:0.22em;text-transform:uppercase;color:#c92a2a;">ARMANI KATEHANO</p>
              <p style="margin:10px 0 0;font-size:20px;font-weight:900;color:#ffffff;">Confirm your subscription</p>
            </td>
          </tr>
          <tr>
            <td style="padding:32px;">
              <p style="margin:0 0 24px;font-size:14px;color:#374151;line-height:1.6;">
                Click the button below to confirm your email address and start receiving roster announcements.
              </p>
              <a href="${safeUrl}"
                 style="display:inline-block;padding:12px 28px;background:#c92a2a;color:#ffffff;font-size:14px;font-weight:700;text-decoration:none;border-radius:8px;">
                Confirm subscription
              </a>
              <p style="margin:24px 0 0;font-size:11px;color:#9ca3af;line-height:1.6;">
                If you did not request this, you can ignore this email -- your address will not be subscribed.<br />
                Link expires after use.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
  const text = `ARMANI KATEHANO\nConfirm your subscription\n\nClick the link below to confirm your email address:\n\n${confirmUrl}\n\nIf you did not request this, ignore this email.`;

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
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping email send");
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
  subscribers:   Array<{ id: string; email: string; token: string }>;
}

export async function sendGameImportedBroadcast({
  game,
  topPerformers,
  subscribers,
}: SendGameImportedBroadcastParams): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping game-imported broadcast");
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
      const html = buildGameImportedHtml(game, topPerformers, appUrl, unsubscribeUrl);
      const text = buildGameImportedText(game, topPerformers, appUrl, unsubscribeUrl);
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

export async function sendAdminAlert({
  subject,
  body,
}: {
  subject: string;
  body: string;
}): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping admin alert");
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
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping import notification");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";

  let result: { subject: string; html: string; text: string };
  if (payload.kind === "success") {
    result = buildImportSuccess(payload);
  } else if (payload.kind === "failure") {
    result = buildImportFailure(payload);
  } else {
    result = buildImportAbandoned(payload);
  }

  try {
    await transport.sendMail({ from: FROM, to, subject: result.subject, html: result.html, text: result.text });
    auditLog("import_notification_sent", { kind: payload.kind });
  } catch (err: any) {
    auditLog("import_notification_failed", { kind: payload.kind, error: err.message });
  }
}

export async function sendImportHeartbeat(payload: HeartbeatPayload): Promise<void> {
  const transport = createTransport();
  if (!transport) {
    console.warn("[email] BREVO_SMTP_USER/PASS not set -- skipping heartbeat");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const { subject, html, text } = buildImportHeartbeat(payload);
  try {
    await transport.sendMail({ from: FROM, to, subject, html, text });
    auditLog("import_heartbeat_sent", { runs: payload.runs.length, dropouts: payload.dropouts.length });
  } catch (err: any) {
    auditLog("import_heartbeat_failed", { error: err.message });
  }
}

export type { SendRosterAnnouncementParams, PlayerSlot, Game, Subscriber } from "./templates";
