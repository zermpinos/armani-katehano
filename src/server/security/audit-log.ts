import * as Sentry from "@sentry/nextjs";

const SECURITY_ALERT_EVENTS = new Set([
  "login_account_locked",
  "login_locked",
  "login_totp_failed",
  "csrf_blocked",
  "csrf_token_blocked",
  "coach_session_revoked",
  "coach_login_account_locked",
  "coach_csrf_blocked",
  "coach_csrf_token_blocked",
]);

export function auditLog(event: string, data: Record<string, unknown> = {}) {
  console.log(JSON.stringify({
    type:      "[AUDIT]",
    event,
    timestamp: new Date().toISOString(),
    ...data,
  }));
  if (SECURITY_ALERT_EVENTS.has(event)) {
    Sentry.captureMessage(`[AUDIT] ${event}`, {
      level: "warning",
      tags:  { audit_event: event },
      extra: data,
    });
  }
}
