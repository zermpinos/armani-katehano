# Pre-Launch Instagram Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce `instagram-carousel/prelaunch-story.svg` — a single 1080×1920 Instagram Story that pre-announces the website launch on Sunday 03.05.2026.

**Architecture:** One self-contained SVG file built incrementally: shared `<defs>` first, then Zone 1 (hook), Zone 2 (name + two blurred locked cards), Zone 3 (CTA). Each zone is verified visually in a browser before the next is added.

**Tech Stack:** Plain SVG (no dependencies). Browser for visual verification.

---

## File Map

| File | Action |
|---|---|
| `instagram-carousel/prelaunch-story.svg` | Create — the only output |

---

## Task 1: SVG skeleton — canvas, defs, background, grid, brackets

**Files:**
- Create: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Create the file with canvas, defs, background, grid lines, and corner brackets**

Write `instagram-carousel/prelaunch-story.svg` with this exact content:

```svg
<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1920" viewBox="0 0 1080 1920">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="#1c1c1e"/>
      <stop offset="100%" stop-color="#141416"/>
    </linearGradient>
    <linearGradient id="redGlow" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#c0392b"/>
      <stop offset="100%" stop-color="#8b1a1a"/>
    </linearGradient>
    <filter id="cardBlur" x="-5%" y="-5%" width="110%" height="110%">
      <feGaussianBlur stdDeviation="14"/>
    </filter>
  </defs>

  <!-- Background -->
  <rect width="1080" height="1920" fill="url(#bg)"/>

  <!-- Top red bar -->
  <rect x="0" y="0" width="1080" height="4" fill="url(#redGlow)"/>

  <!-- Grid lines (zone boundaries + vertical centre) -->
  <line x1="540" y1="0" x2="540" y2="1920" stroke="#242426" stroke-width="1"/>
  <line x1="0" y1="640" x2="1080" y2="640" stroke="#242426" stroke-width="1"/>
  <line x1="0" y1="1280" x2="1080" y2="1280" stroke="#242426" stroke-width="1"/>

  <!-- Corner brackets -->
  <rect x="60" y="60" width="40" height="3" fill="#333336"/>
  <rect x="60" y="60" width="3" height="40" fill="#333336"/>
  <rect x="980" y="60" width="40" height="3" fill="#333336"/>
  <rect x="1017" y="60" width="3" height="40" fill="#333336"/>
  <rect x="60" y="1857" width="40" height="3" fill="#333336"/>
  <rect x="60" y="1820" width="3" height="40" fill="#333336"/>
  <rect x="980" y="1857" width="40" height="3" fill="#333336"/>
  <rect x="1017" y="1820" width="3" height="40" fill="#333336"/>

</svg>
```

- [ ] **Step 2: Open in browser and verify**

```bash
xdg-open instagram-carousel/prelaunch-story.svg
```

Expected: dark gradient background, thin red bar at top, faint grid lines at vertical centre and at y=640/1280, L-brackets at all four corners.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story skeleton — canvas, defs, grid, brackets"
```

---

## Task 2: Zone 1 — Hook (top 640px)

**Files:**
- Modify: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Add hook content inside the `<svg>` tag, before the closing `</svg>`**

Insert after the last corner bracket rect:

```svg
  <!-- ── ZONE 1: HOOK ── -->
  <text x="540" y="210" text-anchor="middle"
        font-family="monospace" font-size="22" letter-spacing="6" fill="#c0392b">ARMANI KATEHANO B.C.</text>

  <text x="540" y="340" text-anchor="middle"
        font-family="monospace" font-size="100" font-weight="bold" letter-spacing="2" fill="#ffffff">SOMETHING</text>
  <text x="540" y="460" text-anchor="middle"
        font-family="monospace" font-size="100" font-weight="bold" letter-spacing="2" fill="#ffffff">IS COMING.</text>

  <!-- Red divider -->
  <rect x="500" y="495" width="80" height="2" fill="#c0392b"/>

  <!-- Date -->
  <text x="540" y="568" text-anchor="middle"
        font-family="monospace" font-size="34" letter-spacing="8" fill="#aaaaaa">03.05.2026</text>
```

- [ ] **Step 2: Verify in browser**

Refresh or reopen the SVG.

Expected: "SOMETHING IS COMING." centred in the top third, red date below a thin red rule, club label above in red.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story zone 1 — hook text"
```

---

## Task 3: Zone 2 — Name reveal block (middle 640px)

**Files:**
- Modify: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Add the name block after the Zone 1 comment block**

```svg
  <!-- ── ZONE 2: NAME + CARDS ── -->
  <text x="540" y="718" text-anchor="middle"
        font-family="monospace" font-size="20" letter-spacing="4" fill="#c0392b">STATS HUB</text>

  <text x="540" y="800" text-anchor="middle"
        font-family="monospace" font-size="64" font-weight="bold" letter-spacing="2" fill="#ffffff">ARMANI KATEHANO</text>

  <text x="540" y="848" text-anchor="middle"
        font-family="monospace" font-size="18" letter-spacing="3" fill="#666666">YOUR TEAM · YOUR STATS · ONLINE</text>
```

- [ ] **Step 2: Verify in browser**

Expected: "STATS HUB" in red, large white name, grey tagline — all centred in the upper part of the middle zone.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story zone 2 — name reveal block"
```

---

## Task 4: Zone 2 — Blurred locked stat card (left)

**Files:**
- Modify: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Add the blurred stat card group and its lock overlay after the name block**

The card occupies x=80–510, y=890–1190. The blur group renders the card contents unreadably; the lock overlay sits outside the filter.

```svg
  <!-- Stat card — blurred -->
  <g filter="url(#cardBlur)">
    <rect x="80" y="890" width="430" height="300" rx="4" fill="#242426" stroke="#2a2a2c" stroke-width="1"/>
    <text x="104" y="934" font-family="monospace" font-size="16" letter-spacing="3" fill="#c0392b">PLAYER STATS</text>
    <text x="104" y="970" font-family="monospace" font-size="18" fill="#888888">#14 · SF/PF</text>
    <text x="104" y="1022" font-family="monospace" font-size="34" font-weight="bold" fill="#ffffff">G. TSIOULKAS</text>
    <text x="120" y="1090" font-family="monospace" font-size="44" font-weight="bold" fill="#ffffff">12.6</text>
    <text x="120" y="1126" font-family="monospace" font-size="16" letter-spacing="2" fill="#666666">PPG</text>
    <text x="258" y="1090" font-family="monospace" font-size="44" font-weight="bold" fill="#ffffff">6.6</text>
    <text x="258" y="1126" font-family="monospace" font-size="16" letter-spacing="2" fill="#666666">RPG</text>
    <text x="388" y="1090" font-family="monospace" font-size="44" font-weight="bold" fill="#ffffff">1.3</text>
    <text x="388" y="1126" font-family="monospace" font-size="16" letter-spacing="2" fill="#666666">APG</text>
  </g>

  <!-- Stat card lock overlay (outside blur) -->
  <!-- Padlock body -->
  <rect x="275" y="1022" width="40" height="34" rx="4" fill="#c0392b"/>
  <!-- Padlock shackle -->
  <path d="M283,1022 v-14 a12,12 0 0,1 24,0 v14" fill="none" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>
  <!-- Keyhole -->
  <circle cx="295" cy="1036" r="5" fill="#141416"/>
  <rect x="293" y="1036" width="4" height="8" fill="#141416"/>
  <!-- Lock date label -->
  <text x="295" y="1175" text-anchor="middle"
        font-family="monospace" font-size="18" letter-spacing="4" fill="#c0392b">03.05</text>
```

- [ ] **Step 2: Verify in browser**

Expected: left card visible but fully blurred/unreadable, red padlock centred over it, "03.05" below the lock.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story zone 2 — blurred locked stat card"
```

---

## Task 5: Zone 2 — Blurred locked player card (right)

**Files:**
- Modify: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Add the blurred player card group and its lock overlay after the stat card block**

The card occupies x=570–1000, y=890–1190, mirroring the stat card on the right.

```svg
  <!-- Player card — blurred -->
  <g filter="url(#cardBlur)">
    <rect x="570" y="890" width="430" height="300" rx="4" fill="#242426" stroke="#2a2a2c" stroke-width="1"/>
    <text x="594" y="934" font-family="monospace" font-size="16" letter-spacing="3" fill="#c0392b">PLAYER CARD</text>
    <!-- Avatar placeholder bar -->
    <rect x="594" y="950" width="382" height="80" rx="2" fill="#1a1a1c"/>
    <text x="594" y="1068" font-family="monospace" font-size="34" font-weight="bold" fill="#ffffff">G. ANTONAKOS</text>
    <text x="594" y="1108" font-family="monospace" font-size="18" fill="#888888">PG · #11</text>
    <!-- Stat bar -->
    <rect x="594" y="1138" width="260" height="6" rx="2" fill="#c0392b"/>
    <rect x="860" y="1138" width="112" height="6" rx="2" fill="#333333"/>
  </g>

  <!-- Player card lock overlay (outside blur) -->
  <!-- Padlock body -->
  <rect x="765" y="1022" width="40" height="34" rx="4" fill="#c0392b"/>
  <!-- Padlock shackle -->
  <path d="M773,1022 v-14 a12,12 0 0,1 24,0 v14" fill="none" stroke="#c0392b" stroke-width="4" stroke-linecap="round"/>
  <!-- Keyhole -->
  <circle cx="785" cy="1036" r="5" fill="#141416"/>
  <rect x="783" y="1036" width="4" height="8" fill="#141416"/>
  <!-- Lock date label -->
  <text x="785" y="1175" text-anchor="middle"
        font-family="monospace" font-size="18" letter-spacing="4" fill="#c0392b">03.05</text>
```

- [ ] **Step 2: Verify in browser**

Expected: right card blurred/unreadable, red padlock centred, "03.05" below — symmetrical to left card.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story zone 2 — blurred locked player card"
```

---

## Task 6: Zone 3 — CTA (bottom 640px)

**Files:**
- Modify: `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Add CTA block after the Zone 2 content, before `</svg>`**

```svg
  <!-- ── ZONE 3: CTA ── -->
  <text x="540" y="1368" text-anchor="middle"
        font-family="monospace" font-size="16" letter-spacing="5" fill="#555555">IT'S ALMOST TIME</text>

  <text x="540" y="1490" text-anchor="middle"
        font-family="monospace" font-size="100" font-weight="bold" letter-spacing="2" fill="#ffffff">SUNDAY.</text>
  <text x="540" y="1612" text-anchor="middle"
        font-family="monospace" font-size="100" font-weight="bold" letter-spacing="2" fill="#c0392b">03.05.</text>

  <!-- Red divider -->
  <rect x="500" y="1645" width="80" height="2" fill="#c0392b"/>

  <!-- Link in bio label -->
  <text x="540" y="1708" text-anchor="middle"
        font-family="monospace" font-size="20" letter-spacing="4" fill="#aaaaaa">LINK IN BIO</text>

  <!-- URL pill -->
  <rect x="260" y="1728" width="560" height="60" rx="4" fill="none" stroke="#c0392b" stroke-width="1.5"/>
  <text x="540" y="1766" text-anchor="middle"
        font-family="monospace" font-size="24" letter-spacing="2" fill="#c0392b">armani-katehano.com</text>

  <!-- Handle -->
  <text x="540" y="1856" text-anchor="middle"
        font-family="monospace" font-size="18" letter-spacing="2" fill="#444444">@armanikatehano_b.c</text>
```

- [ ] **Step 2: Verify the full story in browser**

Expected: bottom zone has "IT'S ALMOST TIME" in dim text, "SUNDAY." in white and "03.05." in red at large scale, red divider, "LINK IN BIO", bordered URL pill with armani-katehano.com, handle at the bottom.

- [ ] **Step 3: Commit**

```bash
git add instagram-carousel/prelaunch-story.svg
git commit -m "feat: prelaunch story zone 3 — CTA"
```

---

## Task 7: Final visual review and close

**Files:**
- Modify (if needed): `instagram-carousel/prelaunch-story.svg`

- [ ] **Step 1: Full-story review checklist**

Open the SVG at full size (or export to PNG with Inkscape/Chrome headless) and check each item:

- [ ] Top red bar visible
- [ ] "SOMETHING IS COMING." centred and dominant in Zone 1
- [ ] "03.05.2026" date legible below divider in Zone 1
- [ ] "ARMANI KATEHANO" name block centred in Zone 2
- [ ] Left stat card blurred — content unreadable — red padlock + "03.05" visible
- [ ] Right player card blurred — content unreadable — red padlock + "03.05" visible
- [ ] "SUNDAY." white + "03.05." red at large scale in Zone 3
- [ ] "armani-katehano.com" in red pill, "@armanikatehano_b.c" below
- [ ] Corner brackets visible at all four corners
- [ ] No text overflows its zone

- [ ] **Step 2: Apply any nudges needed**

Common fixes:
- If text clips a zone boundary, adjust its `y` value by ±10–30px
- If blur is too light (content still readable), increase `stdDeviation` in `<filter id="cardBlur">` (try 18–22)
- If blur is too heavy (padlock obscured), decrease to 10–12

- [ ] **Step 3: Export to PNG for Instagram (optional, if tooling available)**

```bash
# Inkscape
inkscape instagram-carousel/prelaunch-story.svg --export-filename=instagram-carousel/prelaunch-story.png --export-width=1080

# Chrome headless
google-chrome --headless --screenshot=instagram-carousel/prelaunch-story.png \
  --window-size=1080,1920 instagram-carousel/prelaunch-story.svg
```

- [ ] **Step 4: Final commit**

```bash
git add instagram-carousel/prelaunch-story.svg
# Include PNG if exported:
# git add instagram-carousel/prelaunch-story.png
git commit -m "feat: prelaunch story complete — 1080x1920 SVG ready for Instagram"
```
