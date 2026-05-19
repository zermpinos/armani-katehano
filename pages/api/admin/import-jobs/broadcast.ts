import type { NextApiRequest, NextApiResponse } from "next";
import prisma from "@/server/db/client";
import { rlKey } from "@/server/auth/login-attempts";
import { verifyAndPreview, claimAndBroadcast, type VerifyAndPreviewResult } from "@/server/services/broadcast-import";
import { auditLog } from "@/server/security/node/audit-log";
import { esc } from "@/server/integrations/email/templates";

const GENERIC_ERROR_HTML = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Invalid link</title></head>
<body style="font-family:-apple-system,sans-serif;padding:48px;max-width:480px;margin:auto;color:#111">
  <h1 style="font-size:18px;margin:0 0 12px">Invalid or expired link</h1>
  <p style="color:#666;font-size:14px;line-height:1.6">This broadcast link is no longer valid. Re-import the game to generate a new one, or contact support if you believe this is an error.</p>
</body></html>`;

function send(res: NextApiResponse, status: number, html: string) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.status(status).send(html);
}

function renderAlreadyBroadcast(broadcastedAt: Date, opponent: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Already broadcast</title></head>
<body style="font-family:-apple-system,sans-serif;padding:48px;max-width:560px;margin:auto;color:#111">
  <h1 style="font-size:18px;margin:0 0 12px">Already broadcast</h1>
  <p style="color:#666;font-size:14px;line-height:1.6">The recap for <strong>${esc(opponent)}</strong> was broadcast on ${esc(broadcastedAt.toUTCString())}. No further action needed.</p>
</body></html>`;
}

function renderConfirmation(
  token: string,
  result: Extract<VerifyAndPreviewResult, { state: "confirmable" }>,
): string {
  const { game, topPerformers, recipientCount } = result;
  const vsAt = game.location === "home" ? "vs" : "@";
  const matchup = `${vsAt} ${esc(game.opponent)}`;
  const performers = topPerformers.map(p =>
    `<li style="margin:4px 0">#${p.number} ${esc(p.name)} — ${p.pts} pts · ${p.reb} reb · ${p.ast} ast</li>`
  ).join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Confirm broadcast</title></head>
<body style="font-family:-apple-system,sans-serif;padding:48px;max-width:640px;margin:auto;color:#111">
  <h1 style="font-size:20px;margin:0 0 6px">Confirm broadcast</h1>
  <p style="color:#666;font-size:13px;margin:0 0 20px">Recap email for <strong>${matchup}</strong></p>
  <div style="padding:16px 20px;background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;margin:0 0 20px">
    <p style="margin:0 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Final · ${esc(game.playedOn.toUTCString())}</p>
    <p style="margin:0 0 12px;font-size:28px;font-weight:900">${game.teamScore}–${game.opponentScore} (${esc(game.result)})</p>
    <p style="margin:12px 0 4px;font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:0.08em">Top performers</p>
    <ul style="margin:0;padding-left:18px;font-size:14px;color:#374151">${performers}</ul>
  </div>
  <form method="POST" action="/api/admin/import-jobs/broadcast" style="display:flex;gap:12px;align-items:center">
    <input type="hidden" name="token" value="${esc(token)}" />
    <button type="submit" style="padding:10px 24px;background:#10b981;color:#fff;border:none;border-radius:6px;font-size:14px;font-weight:700;cursor:pointer">Send to ${recipientCount} subscribers</button>
    <a href="about:blank" style="color:#6b7280;font-size:13px;text-decoration:none">Cancel</a>
  </form>
</body></html>`;
}

function renderSuccess(recipientCount: number): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Broadcast sent</title></head>
<body style="font-family:-apple-system,sans-serif;padding:48px;max-width:480px;margin:auto;color:#111">
  <h1 style="font-size:18px;margin:0 0 12px;color:#065f46">Broadcast sent</h1>
  <p style="color:#374151;font-size:14px;line-height:1.6">Sent to ${recipientCount} subscribers. Check the audit log for per-recipient delivery details.</p>
</body></html>`;
}

function clientIp(req: NextApiRequest): string {
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string") return fwd.split(",")[0].trim();
  if (Array.isArray(fwd) && fwd.length) return fwd[0].split(",")[0].trim();
  return req.socket?.remoteAddress ?? "unknown";
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === "GET") {
    const token = typeof req.query.token === "string" ? req.query.token : "";
    if (!token) return send(res, 400, GENERIC_ERROR_HTML);
    const result = await verifyAndPreview(token);
    if (!result.ok) {
      auditLog("broadcast_invalid_token", { reason: result.reason });
      return send(res, 400, GENERIC_ERROR_HTML);
    }
    if (result.state === "already_broadcast") {
      return send(res, 200, renderAlreadyBroadcast(result.broadcastedAt, result.game.opponent));
    }
    return send(res, 200, renderConfirmation(token, result));
  }

  if (req.method === "POST") {
    const token = typeof req.body?.token === "string" ? req.body.token : "";
    if (!token) return send(res, 400, GENERIC_ERROR_HTML);

    const ip    = clientIp(req);
    const since = new Date(Date.now() - 5 * 60_000);
    const key   = rlKey(`broadcast_${ip}`);
    const count = await prisma.loginAttempt.count({ where: { ip: key, attemptedAt: { gte: since } } });
    if (count >= 10) {
      auditLog("broadcast_rate_limited", { ip: key });
      return send(res, 429, GENERIC_ERROR_HTML);
    }
    prisma.loginAttempt.create({ data: { ip: key } })
      .catch((err: unknown) => console.error("[broadcast] rate-limit record failed:", err));

    const result = await claimAndBroadcast({ token, ip: key });
    if (!result.ok) {
      if (result.reason === "transport_unavailable") return send(res, 503, GENERIC_ERROR_HTML);
      return send(res, 400, GENERIC_ERROR_HTML);
    }
    if (result.state === "already_broadcast") {
      return send(res, 200, `<!DOCTYPE html><html><body style="font-family:-apple-system,sans-serif;padding:48px;max-width:480px;margin:auto;color:#111"><h1 style="font-size:18px">Already broadcast</h1><p style="color:#666;font-size:14px">Broadcast already sent at ${esc(result.broadcastedAt.toUTCString())}.</p></body></html>`);
    }
    return send(res, 200, renderSuccess(result.recipientCount));
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).end();
}

export const config = { api: { bodyParser: { sizeLimit: "8kb" } } };
