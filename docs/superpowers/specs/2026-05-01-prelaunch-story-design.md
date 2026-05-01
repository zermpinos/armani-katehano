# Pre-Launch Instagram Story — Design Spec

**Date:** 2026-05-01  
**Launch date:** Sunday 03.05.2026  
**Output format:** Single Instagram Story (1080×1920 SVG)  
**Output file:** `instagram-carousel/prelaunch-story.svg`

---

## Overview

A single vertical Instagram Story (not a carousel) that pre-announces the official launch of armani-katehano.com. The story combines mystery-teaser energy with a hard date reveal in one scrollable frame, matching the existing brand aesthetic exactly.

---

## Visual Style

Matches the existing carousel slides exactly:

| Token | Value |
|---|---|
| Background | `#1c1c1e` |
| Surface | `#242426` |
| Border | `#2a2a2c` / `#333336` |
| Red accent | `#c0392b` → `#8b1a1a` (gradient) |
| Text primary | `#ffffff` |
| Text secondary | `#aaaaaa` |
| Text muted | `#555555` |
| Font | Monospace caps (matching existing SVGs) |
| Top bar | 3–4px horizontal red gradient at `y=0` |
| Corner brackets | 40×3px + 3×40px L-shapes at all four corners |
| Grid lines | 1px `#242426` vertical centre + two horizontal thirds |

---

## Layout — Three Zones (1080×1920)

### Zone 1 — Hook (top ~630px, y: 0–630)

| Element | Value |
|---|---|
| Club label | `ARMANI KATEHANO B.C.` · 20px · `#c0392b` · 5px letter-spacing |
| Headline | `SOMETHING IS COMING.` · 72px bold · `#ffffff` · two lines |
| Divider | 40px wide, 2px `#c0392b` horizontal rule |
| Date | `03.05.2026` · 32px · `#aaaaaa` · 8px letter-spacing |

### Zone 2 — Name Reveal + Blurred Cards (middle ~660px, y: 630–1290)

**Name block (centred):**

| Element | Value |
|---|---|
| Eyebrow | `STATS HUB` · 18px · `#c0392b` |
| Name | `ARMANI KATEHANO` · 52px bold · `#ffffff` |
| Tagline | `YOUR TEAM · YOUR STATS · ONLINE` · 16px · `#777777` |

**Two cards side by side, equal width, below name block:**

Both cards share the same treatment: blurred (`filter: blur(8px)` equivalent in SVG via `feGaussianBlur stdDeviation="6"`), overlaid with a lock icon (🔒 or SVG padlock shape) and `03.05` in `#c0392b`.

**Stat Card (left):**
- Label: `PLAYER STATS` · red
- Jersey + position: `#14 · SF/PF`
- Name: `G. TSIOULKAS`
- Stats row: `12.6 PPG / 6.6 RPG / 1.3 APG`

**Player Card (right):**
- Label: `PLAYER CARD` · red
- Avatar placeholder rectangle
- Name: `A. KATEHANO`
- Position: `PG · #7`
- Stat bar (partial fill)

### Zone 3 — CTA (bottom ~630px, y: 1290–1920)

| Element | Value |
|---|---|
| Pre-label | `IT'S ALMOST TIME` · 14px · `#555555` · 5px letter-spacing |
| Date headline | `SUNDAY.` + `03.05.` · 72px bold · white / red |
| Divider | 40px `#c0392b` rule |
| Sub-label | `LINK IN BIO` · 16px · `#aaaaaa` |
| URL pill | `armani-katehano.com` · bordered pill · `#c0392b` border + text |
| Handle | `@armanikatehano_b.c` · 14px · `#444444` |

---

## SVG Implementation Notes

- Canvas: `width="1080" height="1920" viewBox="0 0 1080 1920"`
- Blur effect: `<filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>` applied to card groups
- Lock overlay: SVG `<text>` with 🔒 or a simple path-drawn padlock centred over each blurred card group
- Red gradient: `<linearGradient id="redGlow">` reused from existing slides
- No external assets — all shapes, text, and lines are native SVG primitives

---

## Out of Scope

- Hiding/password-protecting the live site (separate task, user confirmed)
- Any changes to the existing 7-slide carousel
- Animated or interactive version
