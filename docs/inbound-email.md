# Inbound Email Setup -- Game Import Automation

Postmark Inbound receives forwarded emails from `info@sportstats.gr` via Proton and posts them to our webhook. This document covers the full setup.

---

## Overview

```
info@sportstats.gr
      │  game-end confirmation email
      ▼
Proton inbox (filter: sender = info@sportstats.gr)
      │  forward
      ▼
Postmark Inbound address (e.g. abc123@inbound.postmarkapp.com)
      │  HMAC-signed POST
      ▼
POST /api/webhooks/sportstats-game-email
      │
      ├── HMAC verify + IP check
      ├── parse subject "HOME - AWAY (YYYY/MM/DD)"
      ├── fuzzy-match UpcomingGame
      └── queue GameImportJob -> processJob
```

---

## 1. Postmark Account Setup

1. Create a free Postmark account at <https://postmarkapp.com>.
2. In your server, go to **Inbound** -> **Settings**.
3. Copy the **Inbound email address** (e.g. `abc123@inbound.postmarkapp.com`). You will enter this into Proton as the forward destination.
4. Under **Webhook**, set the **Inbound webhook URL** to:
   ```
   https://armani-katehano.vercel.app/api/webhooks/sportstats-game-email
   ```
5. In the webhook settings, set a **Webhook secret token** (any long random string). Copy it -- you will set it as `POSTMARK_WEBHOOK_SECRET`.
6. Enable **Include raw email content** if you ever need the full body; for this flow only the subject is used.

---

## 2. Proton Filter

In Proton Mail:

1. Go to **Settings -> Filters -> Add filter**.
2. Condition: **From** is `info@sportstats.gr`.
3. Action: **Forward to** -> enter the Postmark inbound address from step 1.3.
4. Save. All future emails from `info@sportstats.gr` will be forwarded automatically.

> Proton forwards a copy -- the original stays in your inbox. You do not need to mark emails as read or move them.

---

## 3. IP Allowlist

Postmark's published inbound webhook source IPs (as of 2025-Q4):

```
3.134.147.250
50.31.156.6
50.31.156.77
18.217.206.57
```

These are checked as defense-in-depth. HMAC verification is the primary security control, so an IP change by Postmark will not break the webhook (it logs a warning and continues).

To override the allowlist, set `POSTMARK_ALLOWED_IPS` as a comma-separated list:
```
POSTMARK_ALLOWED_IPS=1.2.3.4,5.6.7.8
```

---

## 4. Environment Variables

Add the following to `.env.local` and to your Vercel project environment:

| Variable                  | Description                                              | Example / Where to get it             |
|---------------------------|----------------------------------------------------------|----------------------------------------|
| `POSTMARK_WEBHOOK_SECRET` | Token from Postmark webhook settings (HMAC signing key)  | Generate in Postmark -> Inbound -> Webhook |
| `POSTMARK_ALLOWED_IPS`    | Optional override for Postmark source IPs (comma-separated) | Leave blank to use built-in defaults |
| `ADMIN_ALERT_EMAIL`       | Address for no-match / no-sourceUrl alerts               | Defaults to `webmaster@armani-katehano.com`    |

---

## 5. Subject Format

The webhook expects subjects in the format:

```
HOME_TEAM - AWAY_TEAM (YYYY/MM/DD)
```

Examples that parse correctly:

```
ARMANI KATEHANO - ΑΡΗΣ (2025/01/15)
ΠΑΝΑΘΗΝΑΪΚΟΣ - ARMANI KATEHANO (2025/02/22)
ΑΡΗΣ -- KATEHANO (2025/03/10)
```

If the strict regex fails, a fuzzy fallback normalises diacritics and accepts alternate separators (`/`, `|`, `:`).

If parsing fails entirely or AK cannot be identified on either side, an admin alert email is sent to `ADMIN_ALERT_EMAIL`.

---

## 6. Fuzzy Game Matching

After parsing the subject, the webhook matches the game against `UpcomingGame` rows by:

1. **Date**: exact calendar-day match (UTC) on `scheduledFor`.
2. **Opponent**: normalised Levenshtein distance ≤ 40% of the longer name.

Normalisation strips diacritics and uppercases before comparing, so "Αρης" matches "ΑΡΗΣ" and "ARIS".

If no match is found or `sourceUrl` is not set, an admin alert is sent and the webhook returns 200.

---

## 7. Admin Alerts

All alerts go to `ADMIN_ALERT_EMAIL` (default `webmaster@armani-katehano.com`) via the existing Gmail transport.

| Condition                        | Alert subject                                              |
|----------------------------------|------------------------------------------------------------|
| Subject cannot be parsed         | `[AK] Import webhook: subject could not be parsed`         |
| No matching UpcomingGame         | `[AK] Import webhook: no matching upcoming game`           |
| Match found, but no `sourceUrl`  | `[AK] Import webhook: sourceUrl missing`                   |

---

## 8. Testing the Webhook Locally

Use `ngrok` or Vercel's local proxy to expose the dev server, then trigger a test payload from Postmark's **Inbound -> Send test** feature. Alternatively, send a signed curl request:

```bash
SECRET="your-postmark-webhook-secret"
BODY='{"From":"info@sportstats.gr","FromFull":{"Email":"info@sportstats.gr"},"Subject":"ARMANI KATEHANO - ΑΡΗΣ (2025/01/15)","TextBody":"test"}'
SIG="sha256=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" -hex | awk '{print $2}')"

curl -X POST http://localhost:3000/api/webhooks/sportstats-game-email \
  -H "Content-Type: application/json" \
  -H "X-Postmark-Signature-256: $SIG" \
  -d "$BODY"
```
