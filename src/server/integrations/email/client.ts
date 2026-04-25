import crypto    from "crypto";
import { Resend } from "resend";
import { auditLog } from "@/server/security/audit-log";
import prisma       from "@/server/db/client";
import {
  esc,
  buildHtml,
  buildText,
  buildImportSuccess,
  buildImportFailure,
  buildNoMatchAlert,
  buildNoSourceUrlAlert,
  type SendRosterAnnouncementParams,
} from "./templates";

export type ImportNotificationPayload =
  | { kind: "success";       opponent: string; location: string; scheduledFor: string; importedAt: Date }
  | { kind: "failure";       opponent: string; location: string; scheduledFor: string; attempts: number; lastError: string | null }
  | { kind: "no-match";      dateStr: string;  opponent: string;  emailSubject: string }
  | { kind: "no-source-url"; opponent: string; location: string; scheduledFor: string; upcomingGameId: string };

const FROM = "Armani Katehano <noreply@armani-katehano.com>";

function createClient(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  return new Resend(key);
}

export async function sendConfirmationEmail({
  email,
  confirmUrl,
}: {
  email: string;
  confirmUrl: string;
}): Promise<void> {
  const client = createClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set -- skipping confirmation email");
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
  const { error } = await client.emails.send({ from: FROM, to: email, subject, html, text });
  if (error) {
    auditLog("confirmation_email_failed", { emailHash, error: error.message });
    throw new Error(error.message);
  }
  auditLog("confirmation_email_sent", { emailHash });
}

export async function sendRosterAnnouncement({
  game,
  players,
  message,
  subscribers,
}: SendRosterAnnouncementParams): Promise<void> {
  const client = createClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set -- skipping email send");
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
      return client.emails.send({ from: FROM, to: sub.email, subject, html, text })
        .then(({ error }) => {
          if (error) {
            auditLog("roster_email_failed", { emailHash, error: error.message, opponent: game.opponent });
            throw new Error(error.message);
          }
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

export async function sendAdminAlert({
  subject,
  body,
}: {
  subject: string;
  body: string;
}): Promise<void> {
  const client = createClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set -- skipping admin alert");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";
  const { error } = await client.emails.send({ from: FROM, to, subject, text: body });
  if (error) {
    auditLog("admin_alert_failed", { subject, error: error.message });
  } else {
    auditLog("admin_alert_sent", { subject });
  }
}

export async function sendImportNotification(payload: ImportNotificationPayload): Promise<void> {
  const client = createClient();
  if (!client) {
    console.warn("[email] RESEND_API_KEY not set -- skipping import notification");
    return;
  }
  const to = process.env.ADMIN_ALERT_EMAIL ?? "webmaster@armani-katehano.com";

  let result: { subject: string; html: string; text: string };
  if (payload.kind === "success") {
    result = buildImportSuccess(payload);
  } else if (payload.kind === "failure") {
    result = buildImportFailure(payload);
  } else if (payload.kind === "no-match") {
    result = buildNoMatchAlert(payload);
  } else {
    result = buildNoSourceUrlAlert(payload);
  }

  const { error } = await client.emails.send({ from: FROM, to, subject: result.subject, html: result.html, text: result.text });
  if (error) {
    auditLog("import_notification_failed", { kind: payload.kind, error: error.message });
  } else {
    auditLog("import_notification_sent", { kind: payload.kind });
  }
}

export type { SendRosterAnnouncementParams, PlayerSlot, Game, Subscriber } from "./templates";
