# Armani Katehano Stats

A statistics, scheduling, and roster-management web app for the **Armani Katehano** basketball team. The public site surfaces season aggregates, per-game box scores, leaderboards, scoring trends, and upcoming-game roster announcements; an authenticated admin portal handles roster, schedule, and stats ingestion (manual and automated); a separate coach portal lets the head coach publish roster announcements without admin privileges.

> Source-available under [PolyForm Noncommercial 1.0.0](LICENSE). Commercial use requires permission.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Architecture Summary](#2-architecture-summary)
3. [Tech Stack](#3-tech-stack)
4. [Services & Integrations](#4-services--integrations)
5. [Features](#5-features)
6. [Project Structure](#6-project-structure)
7. [Usage](#7-usage)
8. [Environment Variables](#8-environment-variables)
9. [Scripts & Tooling](#9-scripts--tooling)
10. [Deployment](#10-deployment)
11. [Additional Notes](#11-additional-notes)

---

## 1. Project Overview

The app is a single-team basketball-stats platform built around a Postgres data model of seasons, leagues, games, players, per-game stat lines, season aggregates, upcoming games, and roster announcements. It serves three audiences:

- **Public visitors** - read-only access to team record, player cards, season leaderboards, game results, scoring trends, and the next-game roster.
- **Team admins** - full CRUD over seasons, leagues, players, schedule, games, and stats; trigger imports; manage email subscribers; recompute aggregates. Reached at a randomized `/admin/<slug>` path and gated by password + TOTP.
- **Head coach** - separate `/coach/<token>` portal for managing rosters and publishing per-game roster announcements via email. Distinct password and session secret from the admin portal.

Box-score ingestion is automated where possible: a discovery service crawls the league listings, matches scheduled opponents (with Greek↔Latin transliteration), scrapes the box score, classifies the page, and persists `PlayerGameStat` rows; aggregates are recomputed transactionally afterwards.

---

## 2. Architecture Summary

The codebase is a Next.js (Pages Router) monolith with a strict layered architecture and a hard runtime boundary between Edge and Node. The full source-of-truth document lives at [`docs/architecture.md`](docs/architecture.md); a summary follows.

### Layer boundaries

```
pages, proxy        ← entry points
   │
   ├── src/features    ← page-scoped components, hooks
   │      └── src/components, src/client  ← UI primitives
   │
   ├── src/server      ← Node-only business logic, DB, auth, integrations
   │
   └── src/domain      ← pure logic; no I/O, no React, no Next, no Prisma
```

Imports may only flow downward and the rule is enforced by `import/no-restricted-paths` in `eslint.config.mjs`. Client components reach server data only through `pages/api/**` routes.

### Edge vs Node runtime split

`proxy.ts` runs on the Vercel **Edge runtime** (V8 isolate, no Node built-ins); the rest of the app runs on the **Node runtime**. Three layers of defense keep them apart:

1. **Structural** -- `src/server/security/` is split into `edge/` (CSP, headers, portable across runtimes) and `node/` (SSRF guard, audit log, client-IP). There is no top-level barrel; importers must declare a zone.
2. **Runtime marker** -- every Node-only file begins with `import "@/server/_internal/node-only";`, a custom marker that throws at module load if it is ever bundled into the browser or Edge runtime.
3. **CI bundle scan** - `scripts/check-middleware-bundle.mjs` runs after `next build` and greps the produced `middleware.js` for known Node built-in identifiers, failing the build if any are present.

Node built-ins must be imported via the `node:` protocol (`import crypto from "node:crypto"`) - enforced by `no-restricted-imports`.

### Data model

PostgreSQL via Prisma. Core entities: `Season`, `League`, `SeasonLeague`, `Player`, `RosterEntry`, `Game`, `PlayerGameStat`, `PlayerSeasonAggregate`, `UpcomingGame`, `GameRosterAnnouncement`, `GameRosterPlayer`, `GameImportJob`, `Subscriber`, `Setting`, `LoginAttempt`. Aggregates store both averages (`ptsAvg`, `rebAvg`, ...) and totals (`ptsTotal`, `rebTotal`, ...) computed from raw stat sums.

---

## 3. Tech Stack

**Runtime & framework**
- Node.js ≥ 24.14
- Next.js 16 (Pages Router)
- React 19
- TypeScript 5

**Database & ORM**
- PostgreSQL (Neon-hosted in production)
- Prisma 7 (`@prisma/client`, `@prisma/adapter-pg`, `pg`)

**Styling & UI**
- Tailwind CSS 3 + PostCSS + Autoprefixer
- Recharts 3 (charts)

**Validation & schemas**
- Zod 4 (request/response, scrape outputs, schedule rows)

**Auth & security**
- `bcryptjs` (password hashing)
- `otpauth` (TOTP for admin)
- Cloudflare Turnstile (subscribe-form CAPTCHA)
- Custom session cookies (signed with `SESSION_SECRET` / `COACH_SESSION_SECRET`)
- CSP with per-request nonce, SSRF allow-list, audit log

**Integrations**
- Nodemailer + Brevo SMTP (transactional email)
- Cheerio + `pdf-parse` (box-score scraping)
- Sentry (`@sentry/nextjs`) - server, edge, and client
- Vercel Analytics & Speed Insights

**Tooling**
- ESLint 9 (with `eslint-plugin-security`, `eslint-plugin-no-unsanitized`, `eslint-config-next`)
- Vitest 4 (unit / integration)
- Playwright (E2E)
- `tsx` (script runner)

---

## 4. Services & Integrations

| Service                 | Purpose                                                  |
|-------------------------|----------------------------------------------------------|
| **Vercel**              | Hosting, Edge middleware, cron, deployment               |
| **Neon (PostgreSQL)**   | Primary database                                         |
| **Brevo (SMTP/Nodemailer)** | Transactional email (subscribe confirm, roster, admin) |
| **Sentry**              | Error tracking and performance monitoring                |
| **Cloudflare Turnstile**| CAPTCHA on the public subscribe form                     |
| **GitHub Actions**      | CI (lint, build, tests), nightly secret scans                                     |
| **Box-score sources**   | League listing pages and per-game box-score URLs scraped via Cheerio / `pdf-parse` |

External HTTP fetches that originate from user-supplied URLs are routed through the SSRF guard in `src/server/security/node/ssrf.ts`, which rejects private/loopback ranges via `node:dns` resolution.

---

## 5. Features

### Public site
- **Home** (`/`) - record, win %, MVP card, recent results, scoring-trend chart (configurable range), top scorers chart, upcoming games with featured roster panel (player avatars via Cloudinary, starter/bench split, coach callout), efficiency leader, email subscribe form.
- **Players** (`/players`) - full roster with per-player season averages and totals; player cards link to individual stat pages (`/players/[slug]`).
- **Games** (`/games`) - chronological game list; completed games link to box-score pages (`/games/[id]`) with playoff round badges (QF / SF / Final); upcoming games open a details modal.
- **Leaderboard** (`/leaderboard`) - sortable, multi-stat leaderboard with season-phase filter (All Season / Regular Season / Playoffs).
- **Team stats** (`/team-stats`) - aggregated team-level metrics with season-phase filter.
- **Subscribe / unsubscribe** - double-opt-in email flow with token-based unsubscribe (`/unsubscribe`) and confirmation (`/api/confirm`).
- **Privacy policy** (`/privacy`).
- **Sitemap** (`/sitemap.xml`).

### Admin portal (`/admin/<slug>`)
- Password + TOTP login with per-IP login-attempt rate limiting and CSRF tokens.
- Dashboard with totals, recent activity, import-job status, and season-phase selector (Regular Season / Playoffs).
- CRUD for **seasons**, **leagues**, **season-leagues**, **players**, **schedule** (`UpcomingGame`), **games** (with round field for playoff tagging), and **per-game stat lines**.
- **Roster** management (active/inactive, per-season-league entries).
- **Manual stats import** (paste box-score URL or upload).
- **Auto-discovery import** - admin enqueues an `UpcomingGame`; a background job (cron-triggered via Vercel cron and a GitHub Actions hourly heartbeat) discovers the matching listing URL, scrapes the box score, classifies, and persists.
- **Aggregate recompute** endpoint for backfills.
- **Roster announcements** - pick the upcoming game, pick the active roster, write a note; the system emails confirmed subscribers via Brevo.
- **Opponent aliases** - manage alternate name mappings so the discovery matcher can resolve opponent names that differ from the league listing.
- **Subscriber management** with cleanup endpoints.

### Coach portal (`/coach/<token>`)
- Separate password and session secret from admin.
- Roster management and roster-announcement publishing for upcoming games.
- Forced password change flow.

### Imports & scraping
- `discover-source-url.ts` - fuzzy matches scheduled opponents to listing rows (Levenshtein with Greek->Latin transliteration so `ΑΟ Νέας Αλικαρνασσού` and `AO Neas Alikarnassou` collapse to the same canonical form).
- `scrape-game.ts` + `import-classifier.ts` + `import-game.ts` - fetch, classify, parse, and persist a box score idempotently.
- `import-job.ts` - locking + retry semantics on `GameImportJob` (PENDING -> IMPORTED / ERROR / ABANDONED) with warning, success, and failure email notifications.
- `stats-recalc.ts` - transactional aggregate recompute (totals from raw DB sums, never approximated from averages).

### Cron / scheduled jobs

All cron endpoints share the same auth shape: `Authorization: Bearer ${CRON_SECRET}`, compared in constant time with `node:crypto.timingSafeEqual` and a length-guard.

- `/api/cron/purge-subscribers` - daily at 03:00 UTC (Vercel cron). Drops unconfirmed subscribers older than 1 day and confirmed subscribers idle for over a year.
- `/api/cron/purge-error-html` - daily at 04:00 UTC (Vercel cron). Clears `GameImportJob.lastErrorHtml` older than 7 days (GDPR storage limitation).
- `/api/cron/purge-upcoming-games` - daily at 04:30 UTC (Vercel cron). Deletes `UpcomingGame` rows whose `scheduledFor` is past **and** whose linked `GameImportJob.state` is `IMPORTED` or `ABANDONED`. Stuck `PENDING` / `ERROR` rows are left for admin review; the imported `Game` is preserved (`importedGameId` uses `onDelete: SetNull`).
- `/api/cron/discover-and-import` - daily at 20:00 UTC (Vercel cron, `0 20 * * *`). T+1h/T+2h/T+3h/T+4h backoff per game; `ABANDONED` after 4 misses with admin email. (Vercel Hobby caps each cron expression at one firing per day; running closer to hourly requires Pro or an external scheduler.)
- `/api/cron/import-heartbeat` - daily at 05:05 UTC (Vercel cron). Emails the admin a digest: last 24 h of cron runs, in-window candidates (last 7 days, not yet `IMPORTED`), dropouts (7-14 days back, not `IMPORTED` / `ABANDONED`), and the next 7 days of scheduled games (excluding `IMPORTED`).

### Security baseline
- Strict CSP with per-request nonce (Edge middleware).
- HTTPS-only, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` lockdown.
- SSRF allow-list for outbound fetches.
- Audit log via Sentry capture for sensitive auth events.
- ESLint security plugins + `no-unsanitized` + `node:` protocol enforcement + Semgrep + Gitleaks workflows.

---

## 6. Project Structure

```
armani-katehano/
├── pages/                          Next.js Pages Router entry points
│   ├── index.tsx, players.tsx, games.tsx, leaderboard.tsx,
│   │   team-stats.tsx, privacy.tsx, sitemap.xml.tsx, unsubscribe.tsx
│   ├── players/[slug].tsx          Individual player stats page
│   ├── games/[id].tsx              Individual game box-score page
│   ├── coming-soon.tsx             Pre-launch gate page
│   ├── admin/[slug]/               Admin portal pages (slug-randomized)
│   │   └── opponent-aliases.tsx    Alternate opponent-name mappings
│   ├── coach/[token].tsx           Coach portal page (token-routed)
│   └── api/                        API routes
│       ├── auth.ts, subscribe.ts, confirm.ts
│       ├── admin/                  Admin endpoints (CRUD, recalc, import)
│       ├── coach/                  Coach auth + endpoints
│       ├── cron/                   Scheduled jobs
│       ├── games/[id].ts           Public box score
│       └── public/data.ts          Public data feed
│
├── src/
│   ├── client/                     Page-scoped client components & hooks
│   │   ├── home/                   home page components + defer-dynamic.ts
│   │   ├── players/, games/, leaderboard/, team-stats/,
│   │   │   admin/, coach/
│   ├── components/                 Shared UI primitives (Layout, StatTile, ErrorBoundary)
│   ├── domain/                     Pure logic - no I/O, no React, no Prisma
│   │   ├── roster.ts               isStarter helper
│   │   ├── games/score.ts, games/phase.ts
│   │   ├── players/format.ts (fmt, initials, slugify), players/positions.ts,
│   │   │   stats/{aggregate,allTime,efficiency,fromLog}.ts, calendar/
│   │   └── shared/                 calendar.ts, cloudinary.ts (cloudinaryThumb),
│   │                               constants.ts, format.ts, sanitize.ts, venues.ts
│   ├── features/                   Reserved for cross-cutting page features
│   ├── schemas/                    Zod schemas (player, game, league, season,
│   │                                roster-announcement, schedule, scrape, ...)
│   ├── server/                     Node-only business logic
│   │   ├── _internal/node-only.ts  Runtime marker
│   │   ├── auth/                   admin-slug, coach, csrf, login-attempts,
│   │   │                            password, session, totp + middleware/
│   │   ├── db/                     Prisma client + repositories
│   │   ├── http/                   method-router, parse-body, handle-error
│   │   ├── integrations/
│   │   │   ├── email/              Nodemailer/Brevo client + templates
│   │   │   └── scraper/            listing + boxscore scrapers
│   │   ├── security/
│   │   │   ├── edge/               CSP, headers (portable across runtimes)
│   │   │   └── node/               SSRF, audit log, client IP (Node-only)
│   │   └── services/               discover-source-url, import-classifier,
│   │                                import-game, import-job, scrape-game,
│   │                                stats-recalc
│   ├── theme/                      Tailwind theme tokens
│   └── types/                      Shared TS types
│
├── prisma/
│   ├── schema.prisma               PostgreSQL schema
│   ├── migrations/                 Prisma migrations
│   ├── seed.ts, seed-data/         Seed data
│
├── lib/
│   ├── generated/prisma/           Prisma client output (generated)
│   └── empty-polyfill-module.js    Webpack stub for Next.js polyfill alias
│
├── scripts/
│   ├── check-middleware-bundle.mjs Post-build assertion: no Node built-ins in Edge bundle
│   ├── strip-next-polyfills.mjs    Prebuild: stubs out Next.js polyfill-module for Turbopack
│   ├── strip-sentry-tracing.mjs    Prebuild: replaces __SENTRY_TRACING__ -> false in SDK files
│   ├── preview-roster-email.ts     Local preview for roster announcement template
│   ├── send-courtesy-email.ts      One-time courtesy email to existing subscribers
│   └── smoke-discover.ts           Smoke-test the discover-source-url matcher
│
├── tests/
│   ├── unit/                       Vitest unit tests
│   └── integration/                Vitest integration tests
├── e2e/                            Playwright specs (admin, public, csp, modals, unsubscribe)
│
├── docs/
│   ├── architecture.md             Source of truth for layer + runtime rules
│   ├── backup-recovery-runbook.md
│   ├── incident-response-runbook.md
│   ├── key-rotation-runbook.md
│   └── monitoring-alerts-runbook.md
│
├── public/                         Static assets
├── styles/                         Global styles
├── proxy.ts                        Edge middleware: coming-soon gate, CSP nonce + headers
├── next.config.mjs
├── tailwind.config.ts
├── eslint.config.mjs
├── vitest.config.js
├── playwright.config.js
├── prisma.config.ts
├── vercel.json                     Vercel cron schedule
├── instrumentation.js              Sentry server init
├── instrumentation-client.js       Sentry client init (sole client entry point)
├── sentry.server.config.js
├── sentry.edge.config.js
├── tsconfig.json
├── package.json
└── SECURITY.md                     Vulnerability disclosure policy
```

---

## 7. Usage

### Prerequisites
- Node.js ≥ 24.14 (`.nvmrc` pins the version)
- A PostgreSQL database (locally or via Neon)
- Brevo SMTP credentials (optional in development; required for email flows)

### First-time setup

```bash
nvm use                            # honor .nvmrc
npm install
cp .env.example .env.local         # then fill in secrets (see § 8)
npx prisma migrate deploy          # apply migrations
npx prisma db seed                 # optional: load seed data
npm run dev                        # http://localhost:3000
```

### Common workflows

| Goal                              | Command                                                  |
|-----------------------------------|----------------------------------------------------------|
| Run the dev server                | `npm run dev`                                            |
| Build for production              | `npm run build`                                          |
| Start the production build        | `npm start`                                              |
| Lint                              | `npm run lint`                                           |
| Unit / integration tests          | `npm test`                                               |
| End-to-end tests (headless)       | `npm run test:e2e`                                       |
| End-to-end tests (Playwright UI)  | `npm run test:e2e:ui`                                    |
| Apply a new migration             | `npx prisma migrate dev --name <slug>`                   |
| Open Prisma Studio                | `npx prisma studio`                                      |
| Smoke-test the URL matcher        | `npx tsx scripts/smoke-discover.ts`                      |
| Preview the roster email template | `npx tsx scripts/preview-roster-email.ts`                |
| Send the one-time game-emails courtesy notice | `npx tsx scripts/send-courtesy-email.ts [--dry-run \| --to=<email> \| --force]` |

### Logging in

- **Admin portal** - visit `/admin/<ADMIN_SLUG>`, enter username, password, and TOTP code. The slug is randomized to keep the login form off public crawlers.
- **Coach portal** - visit `/coach/<COACH_TOKEN>`, enter the coach password.

---

## 8. Environment Variables

Production secrets live on Vercel; local development uses `.env.local`. **Never commit real secret values.**

### Required

| Variable                          | Used by                | Purpose                                                    |
|-----------------------------------|------------------------|------------------------------------------------------------|
| `DATABASE_URL`                    | Prisma                 | Postgres connection string                                 |
| `APP_URL`                         | Server                 | Canonical base URL                                         |
| `NEXT_PUBLIC_APP_URL`             | Client                 | Public base URL used in emails and OG tags                 |
| `NEXT_PUBLIC_BASE_URL`            | Client / SEO           | Public base URL used by sitemap, layout, and `security.txt` |
| `SESSION_SECRET`                  | Admin auth             | HMAC key for the admin session cookie                      |
| `ADMIN_USERS`                     | Admin auth             | JSON array of `{ username, passwordHash, totpSecret }`     |
| `ADMIN_SLUG`                      | Admin auth             | Random URL segment for the admin entry path                |
| `ADMIN_PASSWORD`                  | Admin auth             | bcrypt hash of the admin password                          |
| `ADMIN_ALERT_EMAIL`               | Ops                    | Destination address for admin operational alert emails     |
| `COACH_PASSWORD`                  | Coach auth             | bcrypt hash of the coach password                          |
| `COACH_TOKEN`                     | Coach auth             | URL token for the coach portal entry                       |
| `COACH_SESSION_SECRET`            | Coach auth             | HMAC key for the coach session cookie                      |
| `BREVO_SMTP_USER`                 | Email                  | Brevo SMTP login (email address)                           |
| `BREVO_SMTP_PASS`                 | Email                  | Brevo SMTP password / API key                              |
| `TURNSTILE_SECRET_KEY`            | Admin / coach login    | Cloudflare Turnstile server-side verification (shown after 3 failed login attempts) |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY`  | Admin / coach login    | Cloudflare Turnstile client-side site key                  |
| `BROADCAST_LINK_SECRET`           | Broadcast              | HMAC key for one-click broadcast tokens (generate with `openssl rand -hex 32`) |
| `BROADCAST_RECENCY_DAYS`          | Broadcast              | Integer (default `7`); max age in days for a game to qualify for a broadcast link, and the token TTL |
| `CRON_SECRET`                     | Cron                   | Bearer token gating `/api/cron/*` endpoints                |
| `SCRAPE_HOSTNAME_ALLOWLIST`       | Scrape SSRF guard      | Comma-separated allowlist of hostnames the scraper may reach |

### Optional / environment-specific

| Variable                                  | Purpose                                                         |
|-------------------------------------------|-----------------------------------------------------------------|
| `SENTRY_DSN`, `NEXT_PUBLIC_SENTRY_DSN`    | Sentry server / client DSNs; error reporting is disabled when unset |
| `SENTRY_ORG`                              | Sentry organisation slug, used at build time for sourcemap upload |
| `SENTRY_PROJECT`                          | Sentry project slug, used at build time for sourcemap upload    |
| `SENTRY_AUTH_TOKEN`                       | Source-map upload during build                                  |
| `SCRAPE_LISTING_URL_CUP`                  | Listing URL for the Cup scrape job; required only when the scrape feature is used |
| `SCRAPE_LISTING_URL_MEN`                  | Listing URL for the Men's scrape job; required only when the scrape feature is used |
| `E2E_ADMIN_PASSWORD`                      | Plain admin password used by Playwright global setup            |
| `APP_BASE_URL`                            | Public base URL of the deployed app, used by server-side code that builds absolute URLs |

#### Game-imported broadcast - manual smoke

1. Import a recent test game (any path that lands the `GameImportJob` in `IMPORTED` state).
2. Confirm the admin import-success email contains a "Review & broadcast" button.
3. Click it - a confirmation page renders with the matchup, score, top-3 performers, and "Send to N subscribers" button.
4. With a 1-subscriber test list, click the button - verify the subscriber receives the recap.
5. Click the original email link again - verify the "Already broadcast" page renders.
6. Inspect the `AuditLog` table for `broadcast_link_viewed`, `broadcast_emails_summary`, etc.

### Platform-supplied

These variables are set by the build/runtime environment automatically. Do not set them manually in `.env.local`.

| Variable | Source |
|---|---|
| `CI` | GitHub Actions / CI runners |
| `NODE_ENV` | Node.js runtime |
| `NEXT_RUNTIME` | Next.js (`"nodejs"` or `"edge"`) |
| `VERCEL_ENV` | Vercel (`"production"`, `"preview"`, `"development"`) |
| `VERCEL_URL` | Vercel deployment URL |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Configured per-project in the Vercel dashboard |

### Secret hygiene

- Rotation playbook: [`docs/key-rotation-runbook.md`](docs/key-rotation-runbook.md).
- All commits scanned by Gitleaks via the `.gitleaks.toml` rules (CI workflow `secret-scan.yml`).
- Vulnerability reports: see [`SECURITY.md`](SECURITY.md).

---

## 9. Scripts & Tooling

### npm scripts (`package.json`)

| Script              | What it does                                                        |
|---------------------|---------------------------------------------------------------------|
| `dev`               | `next dev` - local dev server                                       |
| `build`             | prebuild polyfill/Sentry stubs -> `prisma generate` -> `next build`   |
| `start`             | `next start` - serve the production build                           |
| `lint`              | `eslint .` - flat-config lint over the whole repo                   |
| `test`              | `vitest run` - unit + integration tests                             |
| `test:e2e`          | `playwright test` - headless browser tests                          |
| `test:e2e:ui`       | `playwright test --ui` - Playwright UI mode                         |

### Standalone scripts (`scripts/`)

| File                            | Purpose                                                                |
|---------------------------------|------------------------------------------------------------------------|
| `strip-next-polyfills.mjs`      | Prebuild: stubs out Next.js polyfill-module so Turbopack doesn't bundle it |
| `strip-sentry-tracing.mjs`      | Prebuild: replaces `__SENTRY_TRACING__` -> `false` in Sentry SDK files  |
| `check-middleware-bundle.mjs`   | Post-build CI guard: greps `.next/server/middleware.js` for Node built-ins |
| `preview-roster-email.ts`       | Renders the roster-announcement email template to disk for review       |
| `send-courtesy-email.ts`        | One-time CLI dispatcher for the courtesy "What's new" email to existing subscribers |
| `smoke-discover.ts`             | Runs the discover-source-url matcher against fixture listings           |

### CI workflows (`.github/workflows/`)

All workflows run on a self-hosted runner (zero GitHub Actions minutes). See `actions-runner/` for the registered runner installation.

| Workflow                   | Trigger                          | Purpose                                                        |
|----------------------------|----------------------------------|----------------------------------------------------------------|
| `ci.yml`                   | push / PR                        | Single job: lint -> typecheck -> test -> build + middleware guard |
| `e2e.yml`                  | Vercel `deployment_status`       | Playwright suite against the preview URL                       |
| `secret-scan.yml`          | push / PR                        | Gitleaks (scoped to public refs)                               |
| `semgrep.yml`              | push / PR / Monday               | SAST via Semgrep (pip)                                         |
| `deps-audit.yml`           | push / PR (lock file) / Monday   | `npm audit` prod + dev; weekly GitHub Issue report             |
| `docs-link-check.yml`      | PR (docs), Monday, manual        | Lychee dead-link check                                         |
| `internal-config-scan.yml` | PR                               | Blocks proprietary local config from entering main             |
| `release-readiness.yml`    | push / PR                        | Asserts LICENSE and `.env.example` are present                 |

### Linting

`eslint.config.mjs` enforces:
- Layer boundaries (`import/no-restricted-paths`).
- `node:` protocol on Node built-ins (`no-restricted-imports`).
- `eslint-plugin-security` + `eslint-plugin-no-unsanitized`.
- Next.js core-web-vitals presets via `eslint-config-next`.

---

## 10. Deployment

The app is deployed to **Vercel**. Production data is in **Neon Postgres**.

### Vercel configuration

- **Build command** - `npm run build` (runs prebuild polyfill/Sentry stubs, `prisma generate`, `next build`, and the post-build middleware-bundle guard).
- **Node version** - pinned via `.nvmrc` (≥ 24.14).
- **Crons** - declared in [`vercel.json`](vercel.json):
  - `0 3 * * *` -> `/api/cron/purge-subscribers`
  - `0 4 * * *` -> `/api/cron/purge-error-html`
  - `30 4 * * *` -> `/api/cron/purge-upcoming-games`
  - `5 5 * * *` -> `/api/cron/import-heartbeat`
  - `0 20 * * *` -> `/api/cron/discover-and-import`
- **Environment variables** - set in the Vercel dashboard (Production, Preview, Development scopes).

### Database migrations

Run `npx prisma migrate deploy` against the production database during release; the build step only runs `prisma generate`.

### Runbooks

Operational procedures live in `docs/`:
- [`backup-recovery-runbook.md`](docs/backup-recovery-runbook.md)
- [`incident-response-runbook.md`](docs/incident-response-runbook.md)
- [`key-rotation-runbook.md`](docs/key-rotation-runbook.md)
- [`monitoring-alerts-runbook.md`](docs/monitoring-alerts-runbook.md)

---

## 11. Additional Notes

### Design decisions worth knowing

- **Pages Router, not App Router.** The runtime marker (`src/server/_internal/node-only.ts`) is custom because the npm `server-only` package is gated on the `react-server` export condition, which only resolves inside App Router server components. If the codebase migrates to App Router, swap it for `import "server-only";`.
- **No top-level barrel under `src/server/security/`.** Importers must declare `edge` or `node` explicitly; this is what stopped a regression where `proxy.ts` dragged `node:dns` into the Edge bundle via a transitive barrel re-export.
- **Totals are stored, not derived.** `PlayerSeasonAggregate` keeps both `*Avg` and `*Total` columns; totals must come from raw `PlayerGameStat` sums (`stats-recalc.ts`), never approximated from `avg × gp`.
- **Greek↔Latin transliteration** in opponent matching: Levenshtein over raw codepoints fails across scripts, so `discover-source-url.ts` collapses both sides to a canonical Latin form before computing distance.
- **Validation at the boundary.** Every API route and external scrape parses inputs through Zod schemas in `src/schemas/` before they reach business logic; `z.string().cuid()` is used directly (no custom wrappers).

### Limitations

- Single-team scope. The data model has seasons, leagues, and season-leagues, but the UI assumes one home team.
- Box-score scraping is tied to the formats of the league listing pages currently in use; new sources require a new classifier in `import-classifier.ts`.
- Email delivery currently goes through a single Brevo SMTP account; there is no per-subscriber language selection.
- The admin and coach portals share the same Postgres connection; there is no read-replica routing.

### Reporting issues

- Bugs / feature requests - open a GitHub issue (or contact the maintainer if the repository is private).
- Security vulnerabilities - **do not file a public issue**; follow [`SECURITY.md`](SECURITY.md).
