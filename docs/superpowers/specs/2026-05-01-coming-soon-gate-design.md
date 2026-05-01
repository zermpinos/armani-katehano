# Coming Soon Gate — Design Spec

**Date:** 2026-05-01  
**Launch date:** 2026-05-03 00:00:00 UTC  
**Status:** Approved

---

## Goal

Hide the entire website from public visitors until the official launch on Sunday 3 May 2026. Show a branded coming-soon page with the launch date and the existing subscribe form. The gate must lift automatically at launch with no code change required.

---

## Architecture

### Middleware gate (`middleware.ts`)

- Placed at the project root (Next.js auto-discovers it).
- Runs on every incoming request server-side.
- Launch threshold: `new Date('2026-05-03T00:00:00Z')`.
- If `Date.now() < threshold`, rewrite any request not already on `/coming-soon` to `/coming-soon`.
- Excluded from the rewrite (matcher config): `/_next/*`, `/api/*`, static file extensions (`.png`, `.ico`, `.svg`, `.txt`, `.xml`, `.html`).
- After launch the condition is false; the middleware becomes a no-op. Remove it manually when convenient.

### Coming-soon page (`pages/coming-soon.tsx`)

- Standalone page — no `Layout` wrapper (no nav, no footer).
- Full-screen centered layout (`min-h-screen flex flex-col items-center justify-center bg-ak-base`).
- Uses only existing Tailwind `ak-*` color tokens; no new colors introduced.

**Content structure (top to bottom):**

1. **Logo** — `/logohighres.png`, constrained width (~160 px), `object-contain`.
2. **Heading** — `COMING SOON`, large bold `text-ak-text`, with a short `bg-ak-red-bright` underline accent below it.
3. **Launch date** — `"Sunday, 3 May 2026"` in `text-ak-gold`.
4. **Subscribe form** — existing `<SubscribeForm />` component, no modifications to the component itself.

**Meta:** `<title>Coming Soon — Armani Katehano</title>`, no indexing (`<meta name="robots" content="noindex" />`).

---

## Out of scope

- Countdown timer (date as text only).
- Password-bypass for preview (will be removed manually post-launch).
- Changes to any existing page or component other than adding `middleware.ts` and `pages/coming-soon.tsx`.

---

## Removal after launch

Delete `middleware.ts` and `pages/coming-soon.tsx`. No other changes needed.
