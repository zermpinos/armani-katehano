# Armani Katehano Stats

A statistics, scheduling, and roster-management web app for the **Armani Katehano** basketball team. The public site surfaces season aggregates, per-game box scores, leaderboards, scoring trends, season-end awards, and upcoming-game roster announcements (with calendar export); an authenticated admin portal handles roster, schedule, stats ingestion, season archiving, subscriber broadcasts, and site-wide toggles; a separate coach portal lets the head coach publish roster announcements without admin privileges.

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

- **Public visitors** - read-only access to team record, player cards, season leaderboards (with a season-end MVP/leader awards podium), game results, scoring trends, and the next-game roster (with add-to-calendar / Google Calendar links).
- **Team admins** - full CRUD over seasons, leagues, players, schedule, games, and stats; trigger imports; archive completed seasons; broadcast email to subscribers; toggle a playoff popup and site-wide maintenance mode; recompute aggregates. Reached at a randomized `/admin/<slug>` path and gated by passkey (WebAuthn); password + TOTP is an opt-in fallback.
- **Head coach** - separate `/coach/<token>` portal for managing rosters and publishing per-game roster announcements via email. Distinct password and session secret from the admin portal.

Box-score data is ingested manually: an admin pastes a box-score URL; the server scrapes it and resolves a draft against the roster and the season leagues, blocking the save on anything it cannot resolve; the admin reviews and saves, and `PlayerGameStat` rows plus transactionally recomputed aggregates land in one write. Public listing pages are statically generated (ISR) and revalidated on demand the moment an admin mutation affects them, so visitors get near-instant updates without paying for per-request rendering.

---

## 2. Architecture Summary

The codebase is a Next.js (Pages Router) monolith with a strict layered architecture and a deliberate boundary around what the proxy is allowed to import. The full source-of-truth document lives at [`docs/architecture.md`](docs/architecture.md); a summary follows.

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

### Proxy runtime and import boundary

`proxy.ts` runs on the **Node runtime**, and so does the rest of the app: Next 16 renamed middleware to proxy and moved it to Node, and there is no Edge option to opt back into. The proxy still sits on every matched request, so it is kept small and is not allowed to reach the database directly. That is a deliberate constraint rather than a runtime one, and three layers hold it:

1. **Structural** -- `src/server/security/` is split into `edge/` (CSP, headers, cheap enough for the proxy) and `node/` (SSRF guard, audit log, client-IP). There is no top-level barrel; importers must declare a zone. `src/server/auth/session` is the one module outside that tree the proxy may import, by path and never via the `@/server/auth` barrel, which re-exports passkeys.
2. **Runtime marker** -- every Node-only file begins with `import "@/server/_internal/node-only";`, a custom marker that throws at module load if it is ever bundled into the browser.
3. **CI runtime and bundle check** - `scripts/check-proxy-bundle.mjs` runs after `next build`. It asserts the proxy is still on the `nodejs` runtime, resolves the real chunk graph behind the Turbopack loader stub, and fails if Prisma, the Neon driver, `@simplewebauthn/server`, `bcryptjs`, or `nodemailer` reach it.

Node built-ins must be imported via the `node:` protocol (`import crypto from "node:crypto"`) - enforced by `no-restricted-imports`.

### Rendering & caching

Public listing pages (`/`, `/players`, `/games`, `/leaderboard`, `/team-stats`) use `getStaticProps` with `revalidate: 3600` (ISR), falling back to a 60s window if the database is unreachable at build time (e.g. in CI). Admin mutations that affect a public page (game/player/season/roster/popup changes) call into `src/server/services/cache-invalidation.ts`, which fans out on-demand `res.revalidate()` calls to the specific affected paths so changes go live immediately instead of waiting for the hourly refresh. `scripts/check-isr-pages.mjs` is a post-build CI guard that asserts the expected pages were actually pre-rendered and that no admin page leaked into the static output.

### Data model

PostgreSQL via Prisma. Core entities: `Season` (with `archivedAt` for season-end archiving), `League`, `SeasonLeague`, `Player`, `RosterEntry`, `Game`, `PlayerGameStat`, `PlayerSeasonAggregate`, `UpcomingGame`, `GameRosterAnnouncement`, `GameRosterPlayer`, `BroadcastLog`, `PasskeyCredential`, `WebAuthnChallenge`, `Subscriber`, `Setting`, `LoginAttempt`, `CronRun`, `AuditLog`, `ImportDraft`. Aggregates store both averages (`ptsAvg`, `rebAvg`, ...) and totals (`ptsTotal`, `rebTotal`, ...) computed from raw stat sums. `Setting` is a generic key/value store used for feature toggles that don't warrant their own table (maintenance mode, playoff-popup state).

---

## 3. Tech Stack

**Runtime & framework**
- Node.js ≥ 24.15 (`< 25`; pinned by `.nvmrc` and `engines`)
- Next.js 16 (Pages Router), ISR for public pages with on-demand revalidation
- React 19
- TypeScript 6

**Database & ORM**
- PostgreSQL (Neon-hosted in production, via pooled `DATABASE_URL` + direct `DIRECT_URL` for migrations)
- Prisma 7 (`@prisma/client` with `@prisma/adapter-neon` over `@neondatabase/serverless`; `@prisma/adapter-pg` is used only in tests)

**Styling & UI**
- Tailwind CSS 4 (via `@tailwindcss/postcss`)
- Charts are native inline SVG + CSS (`src/client/charts/`), server-rendered where possible - no charting dependency

**Validation & schemas**
- Zod 4 (request/response, scrape outputs, schedule rows)

**Auth & security**
- `@simplewebauthn/server` + `@simplewebauthn/browser` (passkeys / WebAuthn; challenges persisted in `WebAuthnChallenge`, not in-process memory)
- `bcryptjs` (password hashing)
- `otpauth` (TOTP; password+TOTP fallback path)
- Cloudflare Turnstile (subscribe-form and login CAPTCHA)
- Custom session cookies (signed with `SESSION_SECRET` / `COACH_SESSION_SECRET`)
- Build-time, hash-based CSP (no per-request nonce - see [§5 Security baseline](#5-features)) + SSRF allow-list + DB-persisted audit log

**Integrations**
- Nodemailer + Brevo SMTP (transactional email + admin broadcasts)
- Cheerio (box-score scraping)
- Cloudinary (player-photo hosting; URLs are pasted directly by admins and resized client-side via a URL-transform helper, no SDK)
- Self-hosted monitoring: a dependency-free `/api/health` liveness endpoint plus anonymous Web Vitals beaconed to `/api/vitals` (no vendor, no cookies, no PII)

**Tooling**
- ESLint 9 (with `eslint-plugin-security`, `eslint-plugin-no-unsanitized`, `eslint-config-next`)
- Vitest 4 (unit / integration / build-output tests)
- Playwright (E2E)
- `tsx` (script runner)

---

## 4. Services & Integrations

| Service                 | Purpose                                                  |
|-------------------------|----------------------------------------------------------|
| **Vercel**              | Hosting, proxy, cron, deployment                         |
| **Neon (PostgreSQL)**   | Primary database                                         |
| **Brevo (SMTP/Nodemailer)** | Transactional email (subscribe confirm, roster, admin broadcasts) |
| **Cloudflare Turnstile**| CAPTCHA on the public subscribe form and admin/coach login |
| **Cloudinary**          | Player photo hosting; allow-listed in CSP `img-src`, no server-side SDK |
| **GitHub Actions**      | CI (lint, typecheck, test, build), scheduled security/dependency audits |
| **Box-score sources**   | Per-game box-score URLs scraped via Cheerio |

External HTTP fetches that originate from user-supplied URLs are routed through the SSRF guard in `src/server/security/node/ssrf.ts`, which rejects private/loopback ranges via `node:dns` resolution.

---

## 5. Features

### Public site
- **Home** (`/`) - record, win %, MVP card, recent results, scoring-trend chart (configurable range), top scorers chart, upcoming games with featured roster panel (player avatars via Cloudinary, starter/bench split, coach callout, add-to-calendar / "Add to Google Calendar" buttons), efficiency leader, email subscribe form, an archived-season banner once a season is closed out, and a dismissible playoff popup (semifinal/final messaging, version-gated so re-enabling it resurfaces for visitors who already dismissed it).
- **Players** (`/players`) - full roster with per-player season averages and totals; player cards link to individual stat pages (`/players/[slug]`).
- **Games** (`/games`) - chronological game list; completed games link to box-score pages (`/games/[id]`) with playoff round badges (QF / SF / Final); upcoming games open a details modal with calendar export.
- **Leaderboard** (`/leaderboard`) - sortable, multi-stat leaderboard with season-phase filter (All Season / Regular Season / Playoffs) and, once a season has games, a top-3 awards podium (MVP, Top Scorer, Rebounds, Assists, TS%) with a shooting-formula tooltip.
- **Team stats** (`/team-stats`) - aggregated team-level metrics with season-phase filter.
- **Calendar export** (`/api/calendar/ics`) - generates a real `.ics` file (with proper Europe/Athens DST rules) for an upcoming game; linked from roster-announcement/game-imported emails and from the upcoming-game UI alongside a "Add to Google Calendar" link.
- **Subscribe / unsubscribe** - double-opt-in email flow with token-based unsubscribe (`/unsubscribe`) and confirmation (`/api/confirm`).
- **Maintenance page** (`/maintenance`) - shown to visitors when site-wide maintenance mode is on; admins with an active session bypass it transparently (enforced in `proxy.ts`, fails open on error).
- **Privacy policy** (`/privacy`), **sitemap** (`/sitemap.xml`), **humans.txt** (`/api/humans-txt`), **security.txt** (`/.well-known/security.txt`, RFC 9116).
- **Motion & depth** - scroll-driven hero parallax, a reveal on the homepage chart rows, and a hover tilt on stat tiles; built with native CSS scroll-driven animations (no JS, no dependency), gated on `@supports (animation-timeline: view())` and turned off under `prefers-reduced-motion`.

### Admin portal (`/admin/<slug>`)
- Passkey (WebAuthn) login with per-IP login-attempt rate limiting and CSRF tokens; password + TOTP retained as opt-in fallback (gated by `PASSKEY_FALLBACK_TOKEN`).
- Dashboard with totals, recent activity, and season-phase selector (Regular Season / Playoffs).
- **Maintenance** page for the global maintenance-mode toggle and the playoff-popup control (enable/disable, semifinal/final round).
- CRUD for **seasons**, **leagues**, **season-leagues**, **players**, **schedule** (`UpcomingGame`), **games** (with round field for playoff tagging), and **per-game stat lines**.
- **Seasons** page - start/end dates per season, archive/unarchive (shows the public archived-season banner and stops new imports resolving into that season; existing stats are untouched), and a season-level roster panel: checking a player in/out syncs their `RosterEntry` across every league in that season in one save, instead of enrolling them per-league.
- **Roster** pages - manage the org-wide player roster (add/edit/retire players, photos), separate from the per-season enrollment above.
- **Stats import** (paste a box-score URL); the server scrapes and resolves the draft, the admin reviews it, and the save is blocked while anything is unresolved.
- **Aggregate recompute** endpoint for backfills.
- **Roster announcements** - pick the upcoming game, pick the active roster, write a note; the system emails confirmed subscribers via Brevo.
- **Broadcast** - compose a Markdown email to all confirmed subscribers or a chosen subset, preview the rendered HTML and send a test to yourself first, then send with rate limits (1 per 2 min, 5/day) and a persisted send history (`BroadcastLog`). A separate, narrower endpoint emails subscribers about one specific finished game's result (idempotent, won't double-send).
- **Subscriber management** with CSV export and cleanup endpoints.

### Coach portal (`/coach/<token>`)
- Separate password and session secret from admin.
- Roster management and roster-announcement publishing for upcoming games.
- Forced password change flow.

### Imports & scraping
- `scrape-game.ts` (fetch + parse) + `domain/import/classify.ts` (game state: scheduled/live/final) + `domain/import/verify.ts` (checks the scrape against itself before review) + `domain/import/resolve.ts` (pure draft resolution) + `import-commit.ts` (persist idempotently, 409 on a re-imported source URL). `import-pipeline.ts` chains URL to reviewable draft and is the single path both the admin's scrape route and the poll go through.
- `team-schedule.ts` parses the club's two team pages (`SCRAPE_LISTING_URL_MEN`, `SCRAPE_LISTING_URL_CUP`) and `discover-games.ts` returns the games the organisers have posted a result for. This is where candidates come from: a game's URL does not exist until the fixture is published, so it cannot be recorded on an `UpcomingGame` row in advance. Games are keyed by the id in the URL, never the URL itself, since the same game has been served under both `/winter-cup/` and `/super-winter-cup/`.
- The listing is also the only place a game states its league and round. A `/men/` URL is shared by Rookie, BC6 and BC8, so `resolve()` takes the league from the listing label when it has one and falls back to detecting it from the URL otherwise. `1ος Γύρος` is regular season, `Play Offs` is a quarterfinal, `Ημιτελική Φάση` a semifinal.
- A game whose scrape classifies as `final`, passes every `verify()` check and resolves with nothing unresolved is committed unattended by the nightly poll, since a review of it could only agree. Everything else is skipped and imported by hand as before.
- Import alerts go to Slack when `SLACK_WEBHOOK_URL` is set, and to `ADMIN_ALERT_EMAIL` otherwise. Email is also the fallback when the webhook is unreachable or fails, so an unattended run cannot fail silently. The webhook host is pinned to `hooks.slack.com` and is kept out of the audit trail, since the URL is itself the credential.
- A season is picked by its date boundaries, so an archived season and a season whose end date has passed are both out of the running. A season with no end date covers every date, which is why the first game of a new season would otherwise land in the old one.
- Opponent names come from `domain/import/opponents.ts`, which maps the source's spelling to the one the site shows (`ΓΕΡΟΛΥΚΟΙ B.C.` to `Gerolykoi`, `S.H.A.W.` to `Shaw`). A team that is not in the map is never guessed at: the draft keeps the source's spelling so a person can correct it in the review form, and `resolve()` returns `unknownOpponent` so the poll skips and reports it instead of publishing caps and Greek.
- A box score cannot say whether a game was a playoff. The poll takes `round` from the listing label; a manual import instead inherits it from the matching `UpcomingGame` if one exists, so tagging a fixture `semifinal` when you schedule it still carries through. An import with neither is `regular`.
- Every scrape captures its raw payload and a SHA-256 of the fetched bytes into `ImportDraft`, keyed by source URL. The capture is overwritten while it is uncommitted and frozen once a commit stamps its `gameId`, so the bytes behind a saved game cannot be replaced by a later re-scrape. Unlike `AuditLog`, this table has no retention cron: it is the replay corpus for running a rewritten parser against old captures.
- `stats-recalc.ts` - transactional aggregate recompute (totals from raw DB sums, never approximated from averages).

### Cron / scheduled jobs

All cron endpoints share the same auth shape: `Authorization: Bearer ${CRON_SECRET}`, compared in constant time with `node:crypto.timingSafeEqual` and a length-guard. Each run is recorded in `CronRun` (start/finish time, ok/error, summary) for observability.

- `/api/cron/purge-subscribers` - daily at 03:00 UTC (Vercel cron). Drops unconfirmed subscribers older than 1 day and confirmed subscribers idle for over a year.
- `/api/cron/purge-upcoming-games` - daily at 04:30 UTC (Vercel cron). Deletes past `UpcomingGame` rows whose `sourceUrl` belongs to a `Game` that exists. A set `sourceUrl` is not evidence of an import: the poll needs the URL on the fixture before the game is played, so deleting on the field alone would destroy the rows it retries against. Rows still pending import are left untouched; the imported `Game` is preserved (`importedGameId` uses `onDelete: SetNull`).
- `/api/cron/purge-audit-log` - daily at 06:00 UTC (Vercel cron). Deletes `AuditLog` rows older than 90 days.
- `/api/cron/poll-imports` - daily at 21:00 UTC (Vercel cron). Reads both team pages, takes up to 3 games that have a posted result, were played in the last 7 days and are not already in `Game`, and commits the ones that come back complete and internally consistent. Anything else is skipped and can still be imported by hand. The window is a week so a game blocked on someone adding a player or naming a new opponent still imports itself once they have, and games older than that stay out so one that can never import does not raise an alert every night forever. Each run records its per-URL outcome in `CronRun.summary`, and emails `ADMIN_ALERT_EMAIL` about any skip that will not resolve on a later run, plus once on the final run that will see a game still stuck for a self-resolving reason. A game that is merely still being played is never alerted on.
- `/api/admin/cleanup` - daily at 02:00 UTC (Vercel cron). Purges expired `LoginAttempt` rows.

### Security baseline
- **Build-time, hash-based CSP** (set by the proxy) - `src/server/security/edge/csp-hashes.ts` holds a committed allow-list of SHA-256 hashes for every inline `<script>`/`<style>` in the pre-rendered HTML, regenerated via `npm run regenerate-csp-hashes` and verified against the built output in CI (`scripts/check-isr-pages.mjs`). There is no per-request nonce - ISR-cached pages can't vary per request, so the hash approach replaced it.
- HTTPS-only, `Strict-Transport-Security`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` lockdown.
- SSRF allow-list for outbound fetches.
- Audit log written to structured stdout (`[AUDIT]`) and persisted to the `AuditLog` table (client IPs are SHA-256 hashed before storage), with `console.warn` alerts (`[AUDIT_ALERT]`) on high-signal events (locked accounts, blocked CSRF, broadcast abuse); purged after 90 days.
- `security.txt` (RFC 9116) at `/.well-known/security.txt` points to [`SECURITY.md`](SECURITY.md) for vulnerability disclosure.
- ESLint security plugins + `no-unsanitized` + `node:` protocol enforcement + Semgrep + Gitleaks workflows.
- **Monitoring** - `/api/health` is a dependency-free liveness probe (it does not touch the database, so uptime pings add no Neon load); the client beacons anonymous Web Vitals to `/api/vitals`, which validates the metric name, drops anything unknown, and stores no IP or identifier.

---

## 6. Project Structure

```
armani-katehano/
├── pages/                          Next.js Pages Router entry points
│   ├── index.tsx, players.tsx, games.tsx, leaderboard.tsx,
│   │   team-stats.tsx, privacy.tsx, sitemap.xml.tsx, unsubscribe.tsx,
│   │   maintenance.tsx
│   ├── players/[slug].tsx          Individual player stats page
│   ├── games/[id].tsx              Individual game box-score page
│   ├── coming-soon.tsx             Pre-launch gate page
│   ├── admin/[slug]/               Admin portal pages (slug-randomized)
│   │   ├── seasons.tsx             Season CRUD, archive/unarchive, season-level roster enrollment
│   │   ├── roster/                 Org-wide player roster (index + [id] detail)
│   │   ├── schedule/               Upcoming-game schedule (index + [id] detail)
│   │   ├── games/                  Game CRUD (index + [id] detail)
│   │   ├── import.tsx              Box-score import (paste a box-score URL)
│   │   ├── broadcast.tsx           Subscriber email broadcast composer
│   │   ├── subscribers.tsx         Subscriber list, export, cleanup
│   │   ├── passkeys.tsx            Passkey credential management
│   │   └── maintenance.tsx         Maintenance-mode toggle + playoff-popup control
│   ├── coach/[token].tsx           Coach portal page (token-routed)
│   └── api/                        API routes
│       ├── auth.ts, subscribe.ts, confirm.ts
│       ├── auth/passkey/           WebAuthn register/auth options + verify
│       ├── calendar/ics.ts         Public .ics calendar export for a game
│       ├── humans-txt.ts, .well-known/security.txt.ts
│       ├── health.ts, vitals.ts       Liveness probe + anonymous Web Vitals sink
│       ├── admin/                  Admin endpoints (CRUD, recalc, import, broadcast, popup-config, cleanup)
│       │   └── seasons/[id]/       index.ts (dates + league links), archive.ts, unarchive.ts
│       ├── coach/                  Coach auth + endpoints
│       ├── cron/                   Scheduled jobs (purge-subscribers, purge-upcoming-games, purge-audit-log)
│       ├── public/                 Public data feed, maintenance-flag read, upcoming-games
│       └── games/[id].ts           Public box score
│
├── src/
│   ├── client/                     Page-scoped client components & hooks
│   │   ├── charts/                 Native SVG/CSS chart primitives - no chart lib
│   │   ├── home/                   home page components (incl. final-four-popup, calendar-utils)
│   │   ├── players/, games/, leaderboard/, team-stats/,
│   │   │   admin/ (incl. import/, shell/), coach/, shared/
│   ├── components/                 Shared UI primitives (Layout, StatTile, ErrorBoundary, SeasonAwards)
│   ├── domain/                     Pure logic - no I/O, no React, no Prisma
│   │   ├── awards.ts               Season MVP / leader award computation
│   │   ├── roster.ts               isStarter helper
│   │   ├── games/score.ts, games/phase.ts
│   │   ├── players/format.ts (fmt, initials, slugify), players/positions.ts,
│   │   │   stats/{aggregate,allTime,efficiency,fromLog,ratings}.ts
│   │   ├── import/                 resolve.ts (scraped payload to a draft),
│   │   │                           verify.ts (gate over the scrape itself),
│   │   │                           classify.ts (scheduled/live/final),
│   │   │                           identity.ts (our-team match)
│   │   ├── calendar/greek-date.ts  Greek-language date/slug parsing (scraper helper)
│   │   └── shared/                 calendar.ts (.ics builder), cloudinary.ts (cloudinaryThumb),
│   │                               constants.ts, format.ts, sanitize.ts, venues.ts
│   ├── features/                   Reserved for cross-cutting page features
│   ├── schemas/                    Zod schemas (player, game, league, season,
│   │                                roster-announcement, schedule, scrape, ...)
│   ├── server/                     Node-only business logic
│   │   ├── _internal/node-only.ts  Runtime marker
│   │   ├── auth/                   admin-slug, coach, csrf, login-attempts,
│   │   │                            passkey, password, session, totp + middleware/
│   │   ├── db/                     Prisma client + repositories
│   │   ├── http/                   method-router, parse-body, handle-error
│   │   ├── integrations/
│   │   │   ├── email/              Nodemailer/Brevo client + templates
│   │   │   └── scraper/            boxscore scraper
│   │   ├── security/
│   │   │   ├── edge/               CSP (hash-based) + csp-hashes.ts, headers
│   │   │   └── node/               SSRF, audit log, client IP (Node-only)
│   │   └── services/               audit-log-purge, broadcast-import,
│   │                                cache-invalidation, cron-run,
│   │                                import-commit, maintenance-flag,
│   │                                scrape-game, stats-recalc, subscriber
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
│   ├── check-proxy-bundle.mjs     Post-build assertion: proxy runtime + dependencies
│   ├── check-isr-pages.mjs         Post-build assertion: expected pages pre-rendered, CSP hashes match
│   ├── check-postcss-override.mjs  Scan postcss config for overridden entries and report lowest
│   ├── regenerate-csp-hashes.mjs   Recomputes and writes the committed CSP script/style hash allow-list
│   ├── strip-next-polyfills.mjs    Prebuild: stubs out Next.js polyfill-module for Turbopack
│   └── ci/                         CI helper scripts (weekly-security-report.sh, ...)
│
├── tests/
│   ├── unit/                       Vitest unit tests
│   ├── integration/                Vitest integration tests
│   └── build/                      Vitest checks against build output (CSP hashes, ISR page set)
├── e2e/                            Playwright specs (admin, public, csp, modals, unsubscribe, season roster)
│
├── docs/
│   └── architecture.md             Source of truth for layer + runtime rules
│
├── public/                         Static assets
├── styles/                         Global styles
├── proxy.ts                        Request proxy: maintenance-mode gate, CSP + headers
├── next.config.mjs
├── tailwind.config.ts
├── eslint.config.mjs
├── vitest.config.js
├── playwright.config.js
├── prisma.config.ts
├── vercel.json                     Vercel cron schedule
├── tsconfig.json
├── package.json
└── SECURITY.md                     Vulnerability disclosure policy
```

---

## 7. Usage

### Prerequisites
- Node.js ≥ 24.15 (`.nvmrc` pins `24.15.0`; `engines` requires `>=24.15.0 <25`)
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
| Build-output tests (CSP/ISR)      | `npm run test:build` (run against a fresh `npm run build`) |
| End-to-end tests (headless)       | `npm run test:e2e`                                       |
| End-to-end tests (Playwright UI)  | `npm run test:e2e:ui`                                    |
| Regenerate CSP hash allow-list    | `npm run regenerate-csp-hashes` (after changing inline script/style content on a static page) |
| Apply a new migration             | `npx prisma migrate dev --name <slug>`                   |
| Open Prisma Studio                | `npx prisma studio`                                      |

### Logging in

- **Admin portal** - visit `/admin/<ADMIN_SLUG>`. The slug is randomized to keep the login form off public crawlers. Primary auth is passkey (WebAuthn); if `PASSKEY_FALLBACK_TOKEN` is set, a password + TOTP fallback path is also available.
- **Coach portal** - visit `/coach/<COACH_TOKEN>`, enter the coach password.

---

## 8. Environment Variables

Production secrets live on Vercel; local development uses `.env.local`. **Never commit real secret values.**

### Required

| Variable                          | Used by                | Purpose                                                    |
|-----------------------------------|------------------------|--------------------------------------------------------------|
| `DATABASE_URL`                    | Prisma                 | Pooled Postgres connection string (runtime queries)         |
| `DIRECT_URL`                      | Prisma                 | Direct (unpooled) Postgres connection string, used for migrations |
| `NEXT_PUBLIC_APP_URL`             | Client                 | Public base URL used in emails and OG tags                 |
| `NEXT_PUBLIC_BASE_URL`            | Client / SEO           | Public base URL used by sitemap, layout, and `security.txt` |
| `SESSION_SECRET`                  | Admin auth             | HMAC key for the admin session cookie                      |
| `ADMIN_USERS`                     | Admin auth             | JSON array of `{ username, passwordHash }`                 |
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
| `CRON_SECRET`                     | Cron                   | Bearer token gating `/api/cron/*` endpoints                |
| `SCRAPE_HOSTNAME_ALLOWLIST`       | Scrape SSRF guard      | Comma-separated allowlist of hostnames the scraper may reach |
| `SCRAPE_LISTING_URL_MEN`          | Import discovery       | Team page for the weekday leagues, the poll's candidate source |
| `SCRAPE_LISTING_URL_CUP`          | Import discovery       | Team page for the cup, the poll's other candidate source   |
| `SLACK_WEBHOOK_URL`               | Admin alerts           | Slack incoming webhook. When set, import alerts go here instead of email |

### Optional / environment-specific

| Variable                                  | Purpose                                                         |
|-------------------------------------------|-------------------------------------------------------------------|
| `PASSKEY_FALLBACK_TOKEN`                  | Enables the password + TOTP fallback login path; if unset, passkey is the only admin auth method |
| `E2E_ADMIN_USERNAME`                      | Admin username used by Playwright global setup                  |
| `E2E_ADMIN_PASSWORD`                      | Plain admin password used by Playwright global setup            |
| `PLAYWRIGHT_BASE_URL`                     | Base URL targeted by E2E tests (defaults to `http://localhost:3000`) |

### Platform-supplied

These variables are set by the build/runtime environment automatically. Do not set them manually in `.env.local`.

| Variable | Source |
|---|---|
| `CI` | GitHub Actions / CI runners |
| `NODE_ENV` | Node.js runtime |
| `NEXT_RUNTIME` | Next.js (`"nodejs"` or `"edge"`) |
| `VERCEL_ENV` | Vercel (`"production"`, `"preview"`, `"development"`) |
| `VERCEL_URL` | Vercel (deployment URL, set at build time) |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | Configured per-project in the Vercel dashboard |

### Secret hygiene

- Rotation procedures are maintained privately by the maintainers.
- All commits scanned by Gitleaks via the `.gitleaks.toml` rules (CI workflows `secret-scan.yml` per push, and the weekly `secret-scan-audit.yml`, which fails on any historical finding).
- Vulnerability reports: see [`SECURITY.md`](SECURITY.md).

---

## 9. Scripts & Tooling

### npm scripts (`package.json`)

| Script                   | What it does                                                        |
|--------------------------|-----------------------------------------------------------------------|
| `dev`                    | `next dev` - local dev server                                       |
| `build`                  | prebuild polyfill stub -> `prisma generate` -> `next build`         |
| `start`                  | `next start` - serve the production build                           |
| `lint`                   | `eslint .` - flat-config lint over the whole repo                   |
| `test`                   | `vitest run` - unit + integration tests                             |
| `test:build`             | `vitest run tests/build` - asserts CSP hashes and ISR page set match a fresh build |
| `test:e2e`               | `playwright test` - headless browser tests                          |
| `test:e2e:ui`            | `playwright test --ui` - Playwright UI mode                         |
| `regenerate-csp-hashes`  | `node scripts/regenerate-csp-hashes.mjs` - recomputes the committed CSP hash allow-list from a fresh build |

### Standalone scripts (`scripts/`)

| File                              | Purpose                                                                |
|-----------------------------------|------------------------------------------------------------------------|
| `strip-next-polyfills.mjs`        | Prebuild: stubs out Next.js polyfill-module so Turbopack doesn't bundle it |
| `check-proxy-bundle.mjs`          | Post-build CI guard: asserts the proxy runtime and scans its real chunk graph |
| `check-isr-pages.mjs`             | Post-build CI guard: confirms expected pages were statically pre-rendered, no admin page leaked into static output, and committed CSP hashes appear in the built bundle |
| `regenerate-csp-hashes.mjs`       | Walks pre-rendered HTML, SHA-256-hashes inline `<script>`/`<style>` bodies, writes `src/server/security/edge/csp-hashes.ts` |
| `check-postcss-override.mjs`      | Scans postcss config for nested entries and reports the lowest override |
| `ci/weekly-security-report.sh`    | Generates the weekly `npm audit` report and opens/labels a GitHub Issue |

Local-only email-preview scripts (`preview-roster-email.ts`, `preview-confirmation-email.ts`, `preview-game-imported-email.ts`) live outside the public tree and are not committed here.

### CI workflows (`.github/workflows/`)

All workflows run on GitHub-hosted `ubuntu-latest` runners.

| Workflow                   | Trigger                          | Purpose                                                        |
|----------------------------|-----------------------------------|------------------------------------------------------------------|
| `ci.yml`                   | push / PR to `main`              | lint -> prisma generate -> typecheck -> test -> build, then ISR-page check + middleware-bundle guard |
| `e2e.yml`                  | Vercel `deployment_status`       | Playwright suite against the preview URL                       |
| `secret-scan.yml`          | push / PR                        | Gitleaks scoped to the push/PR delta; fails the build on a hit  |
| `secret-scan-audit.yml`    | Monday cron, manual dispatch     | Report-only Gitleaks audit of full `origin/main` history (SARIF artifact, non-blocking) |
| `semgrep.yml`              | push / PR / Monday               | SAST via Semgrep (`p/typescript`, `p/nodejs`, `p/secrets`)      |
| `deps-audit.yml`           | push / PR (lock file) / Monday   | `npm audit` prod + dev; scheduled run opens a weekly GitHub Issue |
| `docs-link-check.yml`      | PR (docs), Monday, manual        | Lychee dead-link check over README / SECURITY.md / docs        |
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

- **Build command** - `npm run build` (runs the prebuild polyfill stub, `prisma generate`, `next build`, and the post-build middleware-bundle / ISR-page guards).
- **Node version** - pinned via `.nvmrc` (`24.15.0`; `engines` requires `>=24.15.0 <25`).
- **Crons** - declared in [`vercel.json`](vercel.json):
  - `0 2 * * *` -> `/api/admin/cleanup`
  - `0 3 * * *` -> `/api/cron/purge-subscribers`
  - `30 4 * * *` -> `/api/cron/purge-upcoming-games`
  - `0 6 * * *` -> `/api/cron/purge-audit-log`
- **Environment variables** - set in the Vercel dashboard (Production, Preview, Development scopes), including the pooled `DATABASE_URL` and direct `DIRECT_URL`.

### Database migrations

Run `npx prisma migrate deploy` against the production database during release, using `DIRECT_URL`; the build step only runs `prisma generate`.

### CSP hash maintenance

Whenever inline script/style content on a statically-rendered page changes, run `npm run regenerate-csp-hashes` against a fresh build and commit the updated `csp-hashes.ts` - CI (`check-isr-pages.mjs`) fails the build if the committed hashes don't match what actually shipped.

---

## 11. Additional Notes

### Design decisions worth knowing

- **Pages Router, not App Router.** The runtime marker (`src/server/_internal/node-only.ts`) is custom because the npm `server-only` package is gated on the `react-server` export condition, which only resolves inside App Router server components. If the codebase migrates to App Router, swap it for `import "server-only";`.
- **No top-level barrel under `src/server/security/`.** Importers must declare `edge` or `node` explicitly; this is what stopped a regression where `proxy.ts` dragged `node:dns` into the proxy bundle via a transitive barrel re-export. That mattered more when the proxy ran on Edge and the import was fatal; it still matters, because the proxy is on every request.
- **Hash-based CSP, not per-request nonce.** ISR-cached pages are served identically to every visitor, so a per-request nonce can't be embedded in them; the CSP allow-list is instead a committed, build-time list of script/style hashes, kept honest by `check-isr-pages.mjs` in CI.
- **Totals are stored, not derived.** `PlayerSeasonAggregate` keeps both `*Avg` and `*Total` columns; totals must come from raw `PlayerGameStat` sums (`stats-recalc.ts`), never approximated from `avg × gp`.
- **Season archiving is presentational.** Marking a `Season.archivedAt` only drives the public "season complete" banner and admin UI state; it doesn't lock stats or prevent further edits.
- **Feature toggles live in a generic `Setting` key/value table** (maintenance mode, playoff-popup enabled/version/round) rather than dedicated columns - simple for a handful of booleans, but not meant to scale into a general config system.
- **No charting dependency.** Charts are hand-built inline SVG + CSS, rendered server-side where the data allows, which dropped Recharts and its client bundle entirely. The motion/depth effects are likewise pure CSS scroll-driven animations, gated behind `@supports` and `prefers-reduced-motion`.
- **Validation at the boundary.** Every API route and external scrape parses inputs through Zod schemas in `src/schemas/` before they reach business logic; `z.string().cuid()` is used directly (no custom wrappers).

### Limitations

- Single-team scope. The data model has seasons, leagues, and season-leagues, but the UI assumes one home team.
- Box-score scraping targets one page shape, the source currently in use. There is no format detection: a new source means new selectors in `integrations/scraper/boxscore.ts`. (`domain/import/classify.ts` classifies game state, not source format.) `domain/import/verify.ts` catches the drift after the fact: it blocks an import when a column the resolver reads has stopped being emitted, rather than saving it as a zero.
- Email delivery currently goes through a single Brevo SMTP account; there is no per-subscriber language selection.
- The admin and coach portals share the same Postgres connection; there is no read-replica routing.

### Reporting issues

- Bugs / feature requests - open a GitHub issue (or contact the maintainer if the repository is private).
- Security vulnerabilities - **do not file a public issue**; follow [`SECURITY.md`](SECURITY.md).
