# Key Rotation Runbook

## Secrets inventory

| Secret | Audience | Where set |
|---|---|---|
| `SESSION_SECRET` | Admin portal (`__Host-ak_session`) | Vercel env var |
| `COACH_SESSION_SECRET` | Coach portal (`__Host-ak_coach`) | Vercel env var |

Both are 32-byte random hex strings (256-bit). Generate a replacement:
```sh
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## Rotation procedure

### 1. Admin session secret (`SESSION_SECRET`)

Effect: all active admin sessions are immediately invalidated — admins must log in again.

1. Generate a new value (command above).
2. In Vercel → Project Settings → Environment Variables, update `SESSION_SECRET` for **Production** (and Preview if used).
3. Trigger a redeployment so the new value is picked up by the serverless runtime.
4. Verify: attempt an existing admin session cookie — it must be rejected. Log in fresh to confirm the new secret works.

### 2. Coach session secret (`COACH_SESSION_SECRET`)

Effect: all active coach sessions are immediately invalidated — coaches must log in again.

1. Generate a new value.
2. Update `COACH_SESSION_SECRET` in Vercel env vars.
3. Redeploy.
4. Verify: existing coach cookie rejected; fresh login succeeds.

---

## Rotation schedule

Rotate **quarterly** (every ~90 days) or immediately after:

- A secret is suspected compromised.
- A team member with env-var access leaves.
- An unplanned production incident involving session tokens.

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
