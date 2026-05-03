# Key Rotation Runbook

## Secrets inventory

| Secret | Audience | Where set |
|---|---|---|
| `SESSION_SECRET` | Admin portal (`__Host-ak_session`) | Vercel env var |
| `COACH_SESSION_SECRET` | Coach portal (`__Host-ak_coach`) | Vercel env var |
| `ADMIN_PASSWORD` | Admin login (`/api/auth`) -- bcrypt hash | Vercel env var |
| `COACH_PASSWORD` | Coach login fallback (`/api/coach/auth`) -- bcrypt hash | Vercel env var |
| `BREVO_SMTP_USER` | Outbound email via Brevo SMTP (login) | Vercel env var |
| `BREVO_SMTP_PASS` | Outbound email via Brevo SMTP (password/API key) | Vercel env var |
| `CRON_SECRET` | Cron endpoint bearer auth (`/api/cron/*`, `/api/admin/cleanup`) | Vercel env var |

Generate a new HMAC secret (SESSION_SECRET / COACH_SESSION_SECRET / CRON_SECRET):
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Generate a new bcrypt password hash (ADMIN_PASSWORD / COACH_PASSWORD):
```sh
node -e "const b=require('bcryptjs');b.hash('YOUR_NEW_PASSWORD',12).then(console.log)"
```

---

## Rotation procedure

### 1. Admin session secret (`SESSION_SECRET`)

Effect: all active admin sessions are immediately invalidated -- admins must log in again.

1. Generate a new value (command above).
2. In Vercel -> Project Settings -> Environment Variables, update `SESSION_SECRET` for **Production** (and Preview if used).
3. Trigger a redeployment so the new value is picked up by the serverless runtime.
4. Verify: attempt an existing admin session cookie -- it must be rejected. Log in fresh to confirm the new secret works.

### 2. Coach session secret (`COACH_SESSION_SECRET`)

Effect: all active coach sessions are immediately invalidated -- coaches must log in again.

1. Generate a new value.
2. Update `COACH_SESSION_SECRET` in Vercel env vars.
3. Redeploy.
4. Verify: existing coach cookie rejected; fresh login succeeds.

### 3. Admin password (`ADMIN_PASSWORD`)

Effect: the current admin password stops working immediately on next deploy.

1. Choose a new strong password.
2. Generate a bcrypt hash (command above, cost factor 12).
3. Update `ADMIN_PASSWORD` in Vercel env vars with the **hash** (not the plaintext).
4. Trigger a redeployment.
5. Verify: old password rejected at `/api/auth`; new password accepted.

> `ADMIN_PASSWORD` is always stored as a bcrypt hash -- never the raw password.

### 4. Coach password (`COACH_PASSWORD`)

Effect: the env-var fallback coach password stops working immediately on next deploy. If `coach_password_hash` is also set in the DB, rotate that separately via the coach settings UI.

1. Choose a new strong password.
2. Generate a bcrypt hash.
3. Update `COACH_PASSWORD` in Vercel env vars with the **hash**.
4. Redeploy.
5. Verify: old password rejected at `/api/coach/auth`; new password accepted.

### 5. Brevo SMTP credentials (`BREVO_SMTP_USER` / `BREVO_SMTP_PASS`)

Effect: outbound emails (confirmation, roster announcements, admin alerts) stop sending until the new credentials are deployed.

1. In the Brevo dashboard -> SMTP & API -> SMTP, generate a new SMTP key or rotate the password.
2. Update `BREVO_SMTP_USER` and `BREVO_SMTP_PASS` in Vercel env vars.
3. Redeploy.
4. Verify: trigger a test subscription and confirm delivery from `noreply@armani-katehano.com`.

### 6. Cron secret (`CRON_SECRET`)

Effect: all cron-triggered endpoints (`/api/cron/*`, `/api/admin/cleanup`) stop responding to the old bearer token immediately on next deploy. Vercel cron jobs pick up the new secret automatically.

1. Generate a new 32-byte hex value (command above).
2. Update `CRON_SECRET` in Vercel env vars.
3. Redeploy -- Vercel automatically injects the new value as the `Authorization: Bearer` header on cron requests.
4. Verify: confirm the next scheduled cron run completes without a 401 in logs.

---

## Rotation schedule

Rotate **quarterly** (every ~90 days) or immediately after any of:

- A secret is suspected compromised.
- A team member with env-var access leaves.
- An unplanned production incident involving session tokens or credentials.
- Brevo SMTP credentials are suspected compromised (rotate `BREVO_SMTP_USER` / `BREVO_SMTP_PASS`).

Emergency trigger matrix:

| Signal | Rotate |
|---|---|
| Unauthorized admin access | `ADMIN_PASSWORD`, `SESSION_SECRET` |
| Unauthorized coach access | `COACH_PASSWORD`, `COACH_SESSION_SECRET` |
| Email sending abuse | `BREVO_SMTP_PASS` |
| Cron endpoint abuse | `CRON_SECRET` |
| Secret committed to git | All secrets -- treat as fully compromised |

---

## Session invalidation without secret rotation

If you need to invalidate all coach sessions without rotating the HMAC secret (e.g., suspicious activity on one account), increment the session version in the DB:

```ts
import { incrementCoachSessionVersion } from "@/lib/coachAuth";
await incrementCoachSessionVersion();
```

This is cheaper than a secret rotation and does not require a redeployment.

---

## Generating initial secrets

Run once when setting up a new environment:

```sh
# SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# COACH_SESSION_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Set both in `.env.local` for local development and in Vercel for production. **Never commit these values to git.**
