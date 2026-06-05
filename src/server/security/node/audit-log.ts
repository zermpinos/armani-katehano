import "@/server/_internal/node-only";
import { createHash } from "node:crypto";
import prisma from "@/server/db/client";

export const SECURITY_ALERT_EVENTS = new Set([
  "login_account_locked",
  "login_locked",
  "login_totp_failed",
  "csrf_blocked",
  "csrf_token_blocked",
  "coach_session_revoked",
  "coach_login_account_locked",
  "coach_csrf_blocked",
  "coach_csrf_token_blocked",
  "broadcast_invalid_token",
  "broadcast_sent",
]);

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  if (typeof data.ip !== "string") return data;
  return { ...data, ip: createHash("sha256").update(data.ip).digest("hex") };
}

export function auditLog(event: string, data: Record<string, unknown> = {}) {
  const sanitized = sanitize(data);

  console.log(JSON.stringify({
    type:      "[AUDIT]",
    event,
    timestamp: new Date().toISOString(),
    ...sanitized,
  }));

  if (SECURITY_ALERT_EVENTS.has(event)) {
    console.warn(JSON.stringify({
      type:  "[AUDIT_ALERT]",
      event,
      ...sanitized,
    }));
  }

  prisma.auditLog.create({
    data: { event, data: sanitized as object },
  }).catch((err: Error) => {
    console.error(JSON.stringify({ type: "[AUDIT_DB_ERROR]", event, error: err.message }));
  });
}
