# Armani Katehano — Basketball Stats Website

Full-stack Next.js app. Public stats site + secure admin panel. Vercel + KV.

---

## Architecture

```
/pages
  index.js          ← Home dashboard
  players.js        ← Roster grid + player detail modal
  leaderboard.js    ← Sortable stats table
  games.js          ← Game results + box score drill-down
  trends.js         ← Stat trend charts (team + per-player)
  team.js           ← Team-level aggregated stats
  schedule.js       ← Upcoming games
  404.js            ← Custom 404

  /admin
    [slug].js       ← SECRET URL admin panel (wrong slug → 404)

  /api
    auth.js         ← POST (login) / DELETE (logout) — brute-force protected
    convert.js      ← POST — PDF → Anthropic → structured JSON (auth required)
    /admin
      data.js       ← GET (load all) / POST (save one key) (auth required)
    /public
      data.js       ← GET all public data (no auth, CDN-cached)

/lib
  data.js           ← Vercel KV helpers + stats recalculation
  security.js       ← HMAC cookies, password compare, headers, audit log
  requireAuth.js    ← Middleware wrapper for protected API routes
  parser.js         ← Basket City PDF text → structured JSON
  theme.js          ← Design tokens (C.red, C.text, etc.)
```

---

## Security Model

| Layer | Details |
|---|---|
| **Secret URL** | `/admin/[RANDOM_SLUG]` — wrong slug = identical 404 |
| **Password auth** | HMAC-SHA256 signed httpOnly cookie, 8hr TTL |
| **Brute-force** | IP lockout after 5 attempts, 15min (Vercel KV) |
| **Anthropic key** | Server-side only — never reaches the browser |
| **PDF validation** | Magic bytes check + 5MB cap |
| **Rate limiting** | 10 PDF conversions/min/IP |
| **Security headers** | CSP, HSTS, X-Frame-Options, nosniff — applied site-wide via next.config.js AND vercel.json |
| **Timing safety** | `crypto.timingSafeEqual` for slug and password comparison |
| **Audit log** | Every auth attempt + conversion → Vercel log stream |
| **Data access** | Public pages read-only via `/api/public/data` — admin writes via authenticated `/api/admin/data` |

---

## Setup

### 1. Generate your secrets

```bash
# Admin password (20+ chars)
node -e "console.log(require('crypto').randomBytes(20).toString('base64url'))"

# Session signing secret (64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"

# URL slug (secret path for admin)
node -e "console.log(require('crypto').randomBytes(16).toString('base64url'))"
```

### 2. Create a Vercel KV database

1. Open your Vercel project dashboard
2. **Storage** → **Create Database** → **KV**
3. **Connect to Project** → this auto-adds the `KV_*` env vars

### 3. Add environment variables

In Vercel → **Project Settings** → **Environment Variables**:

| Variable | Value |
|---|---|
| `ADMIN_PASSWORD` | From step 1 (password) |
| `SESSION_SECRET` | From step 1 (session secret) |
| `ADMIN_SLUG` | From step 1 (URL slug) |
| `NEXT_PUBLIC_ADMIN_SLUG` | Same as `ADMIN_SLUG` |
| `KV_*` | Auto-added in step 2 |

### 4. Deploy

```bash
git init
git add .
git commit -m "initial"
# Connect to Vercel via dashboard or CLI:
npx vercel
```

---

## Using the admin panel

1. Navigate to `https://yoursite.com/admin/YOUR_SLUG`
2. Enter your password
3. **Import PDF** — drag a Basket City game PDF:
   - Claude extracts all stats server-side
   - You see a confirmation screen with every stat pre-filled
   - Edit anything that looks wrong
   - Click **Confirm & Save** — player season averages auto-recalculate
4. Use **Game Results** section to add/edit games manually
5. Use **Roster** to update player profiles
6. Use **Schedule** to manage upcoming games
7. Use **Season Record** to update win/loss totals

---

## Data model (Vercel KV keys)

| Key | Contents |
|---|---|
| `ak:team` | `{ name, abbreviation, season }` |
| `ak:record` | `{ wins, losses, homeWins, homeLosses, awayWins, awayLosses, streak, pointsPerGame, pointsAllowedPerGame }` |
| `ak:players` | `Player[]` sorted by jersey number |
| `ak:games` | `Game[]` with full box scores |
| `ak:schedule` | `ScheduleItem[]` upcoming games |

Player season averages (`ppg`, `rpg`, etc.) are automatically recalculated from box scores every time a game is saved.
