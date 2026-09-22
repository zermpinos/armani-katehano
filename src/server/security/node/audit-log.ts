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

// Worth auditing is not the same as worth interrupting someone. broadcast_sent
// is a routine admin action, a single mistyped TOTP code is not an incident, and
// a revoked coach session is usually the admin doing it on purpose. Delivering
// those trains the reader to ignore the channel, so the delivered set is a
// strict subset of the audited one.
export const PAGE_WORTHY_EVENTS = new Set([
  "login_account_locked",
  "login_locked",
  "coach_login_account_locked",
  "csrf_blocked",
  "csrf_token_blocked",
  "coach_csrf_blocked",
  "coach_csrf_token_blocked",
  "broadcast_invalid_token",
]);

function sanitize(data: Record<string, unknown>): Record<string, unknown> {
  if (typeof data.ip !== "string") return data;
  return { ...data, ip: createHash("sha256").update(data.ip).digest("hex") };
}

export async function auditLog(event: string, data: Record<string, unknown> = {}) {
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

  const writes: Promise<unknown>[] = [
    prisma.auditLog.create({
      data: { event, data: sanitized as object },
    }).catch((err: Error) => {
      console.error(JSON.stringify({ type: "[AUDIT_DB_ERROR]", event, error: err.message }));
    }),
  ];

  if (PAGE_WORTHY_EVENTS.has(event)) {
    // Loaded on demand. The dispatcher pulls in the mail transport, which would
    // otherwise be resident in every API route that writes an audit line.
    writes.push(import("@/server/services/security-alert")
      .then(m => m.dispatchSecurityAlert(event, sanitized))
      .catch((err: Error) => {
        console.error(JSON.stringify({ type: "[AUDIT_ALERT_ERROR]", event, error: err.message }));
      }));
  }

  // Callers await this before responding: a serverless function can be frozen
  // once its response is sent, taking a pending write with it. Both writes
  // catch their own errors, so an audit failure never fails the request.
  await Promise.all(writes);
}
