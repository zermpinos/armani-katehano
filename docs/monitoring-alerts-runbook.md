# Monitoring & Alerting Runbook

**Control:** CC7.1 -- System monitoring, anomaly detection  
**Last reviewed:** 2026-04-19

---

## Overview

Two alert surfaces are in use:

| Surface | What it covers |
|---------|---------------|
| Sentry (Issues) | Unhandled exceptions, runtime errors, security audit events |
| Vercel log drain | Full `[AUDIT]` JSON stream (all events, including lower-severity ones) |

Security-critical audit events are forwarded to Sentry by `auditLog()` in `lib/security.ts` so that Sentry alert rules can page on them without requiring manual log inspection.

---

## Sentry Alert Rules to Configure

Configure these in **Sentry -> Alerts -> Create Alert Rule**.  
All rules should notify the **#security-alerts** Slack channel (or equivalent on-call channel).

### Rule 1 -- Error-rate spike

| Field | Value |
|-------|-------|
| Environment | production |
| Condition | Number of errors > **10** in **5 minutes** |
| Filter | None |
| Action | Notify: Slack `#security-alerts`; optionally PagerDuty/Opsgenie |
| Name | `prod-error-rate-spike` |

### Rule 2 -- Account lockout

| Field | Value |
|-------|-------|
| Environment | production |
| Condition | Issue title contains `[AUDIT] login_account_locked` **or** `[AUDIT] coach_login_account_locked`; count ≥ **1** in **5 minutes** |
| Action | Notify: Slack `#security-alerts` |
| Name | `prod-account-lockout` |

### Rule 3 -- CSRF blocked

| Field | Value |
|-------|-------|
| Environment | production |
| Condition | Issue title contains `[AUDIT] csrf_blocked` **or** `[AUDIT] csrf_token_blocked` **or** `[AUDIT] coach_csrf_blocked`; count ≥ **3** in **5 minutes** |
| Action | Notify: Slack `#security-alerts` |
| Name | `prod-csrf-attack` |

### Rule 4 -- Coach session revoked

| Field | Value |
|-------|-------|
| Environment | production |
| Condition | Issue title contains `[AUDIT] coach_session_revoked`; count ≥ **1** |
| Action | Notify: Slack `#security-alerts` |
| Name | `prod-coach-session-revoked` |

### Rule 5 -- TOTP failures (credential stuffing indicator)

| Field | Value |
|-------|-------|
| Environment | production |
| Condition | Issue title contains `[AUDIT] login_totp_failed`; count ≥ **5** in **10 minutes** |
| Action | Notify: Slack `#security-alerts` |
| Name | `prod-totp-failures` |

---

## How Security Events Reach Sentry

`lib/security.ts -> auditLog()` calls `Sentry.captureMessage("[AUDIT] <event>", { level: "warning" })` for every event in `SECURITY_ALERT_EVENTS`. The full event `data` object (IP, path, etc.) is attached as Sentry `extra` and the event name is set as a `tags.audit_event` tag for easy filtering.

Events **not** in `SECURITY_ALERT_EVENTS` (e.g. normal login success, roster emails) are logged to stdout only and do not appear in Sentry.

---

## Vercel Log Drain (Full Audit Stream)

To retain the full `[AUDIT]` stream for forensic purposes:

1. In Vercel -> Project -> Settings -> Log Drains, add a drain endpoint.
2. Filter on log lines containing `"[AUDIT]"`.
3. Forward to your SIEM or long-term storage (e.g. Datadog, Logtail, S3 via Kinesis).

Retention target: **90 days** (aligns with GDPR breach-notification look-back).

---

## Review Cadence

| Activity | Frequency |
|----------|-----------|
| Verify Sentry alert rules are active | Monthly |
| Review alert noise / tune thresholds | Quarterly |
| Test alert delivery (trigger a lockout in staging) | Quarterly |
| Update this runbook after any auth flow change | On change |

---

## Alert Triage

See `docs/incident-response-runbook.md` for severity classification, GDPR-72h trigger logic, and escalation contacts.
