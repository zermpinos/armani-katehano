# Coming Soon Gate Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Block all public routes until 2026-05-03 00:00 UTC, showing a branded coming-soon page with the launch date and subscribe form.

**Architecture:** A Next.js Edge middleware rewrites every non-asset request to `/coming-soon` while `Date.now()` is before the launch threshold. A standalone `pages/coming-soon.tsx` renders the branded page using existing `ak-*` Tailwind tokens, the high-res logo, and the existing `<SubscribeForm />`.

**Tech Stack:** Next.js 13+ middleware (Edge runtime), Tailwind CSS (`ak-*` tokens), Vitest (file-content assertions).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `middleware.ts` | Edge gate — rewrites to `/coming-soon` before launch |
| Create | `pages/coming-soon.tsx` | Branded standalone page |
| Create | `tests/unit/coming-soon-gate.test.ts` | Regression guard for middleware + page |

---

### Task 1: Write failing tests for the middleware and coming-soon page

**Files:**
- Create: `tests/unit/coming-soon-gate.test.ts`

- [ ] **Step 1: Create the test file**

```typescript
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("coming-soon gate", () => {
  describe("middleware.ts", () => {
    it("exists at the project root", () => {
      expect(() => read("middleware.ts")).not.toThrow();
    });

    it("compares Date.now() against the 2026-05-03 UTC threshold", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/2026-05-03/);
    });

    it("rewrites to /coming-soon when before launch", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/coming-soon/);
      expect(src).toMatch(/rewrite/i);
    });

    it("excludes _next and api paths from the matcher", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/_next/);
      expect(src).toMatch(/api/);
    });
  });

  describe("pages/coming-soon.tsx", () => {
    it("exists", () => {
      expect(() => read("pages/coming-soon.tsx")).not.toThrow();
    });

    it("does not import Layout (standalone page)", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).not.toMatch(/import.*Layout/);
    });

    it("displays the launch date text", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/3 May 2026/);
    });

    it("includes the SubscribeForm", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/SubscribeForm/);
    });

    it("uses the high-res logo", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/logohighres/);
    });

    it("sets noindex meta", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/noindex/);
    });
  });
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
npx vitest run tests/unit/coming-soon-gate.test.ts
```

Expected: all tests FAIL (files don't exist yet).

---

### Task 2: Create the middleware gate

**Files:**
- Create: `middleware.ts`

- [ ] **Step 1: Create `middleware.ts` at the project root**

```typescript
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LAUNCH = new Date("2026-05-03T00:00:00Z").getTime();

export function middleware(request: NextRequest) {
  if (Date.now() >= LAUNCH) return NextResponse.next();
  if (request.nextUrl.pathname === "/coming-soon") return NextResponse.next();
  return NextResponse.rewrite(new URL("/coming-soon", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|.*\\.(?:png|ico|svg|txt|xml|html|webmanifest)$).*)",
  ],
};
```

- [ ] **Step 2: Run the middleware tests**

```bash
npx vitest run tests/unit/coming-soon-gate.test.ts --reporter=verbose
```

Expected: all 4 middleware tests PASS, page tests still FAIL.

---

### Task 3: Create the coming-soon page

**Files:**
- Create: `pages/coming-soon.tsx`

- [ ] **Step 1: Create `pages/coming-soon.tsx`**

```tsx
import Head from "next/head";
import Image from "next/image";
import { SubscribeForm } from "@/client/home/subscribe-form";

export default function ComingSoon() {
  return (
    <>
      <Head>
        <title>Coming Soon — Armani Katehano</title>
        <meta name="robots" content="noindex" />
      </Head>

      <main className="min-h-screen flex flex-col items-center justify-center bg-ak-base px-6 py-12 gap-8">
        <Image
          src="/logohighres.png"
          alt="Armani Katehano"
          width={160}
          height={160}
          className="object-contain"
          priority
        />

        <div className="flex flex-col items-center gap-2 text-center">
          <h1 className="text-4xl font-bold tracking-widest text-ak-text uppercase">
            Coming Soon
          </h1>
          <div className="h-1 w-16 rounded bg-ak-red-bright" />
        </div>

        <p className="text-ak-gold text-lg font-semibold tracking-wide">
          Sunday, 3 May 2026
        </p>

        <div className="w-full max-w-sm">
          <SubscribeForm />
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 2: Run all coming-soon tests**

```bash
npx vitest run tests/unit/coming-soon-gate.test.ts --reporter=verbose
```

Expected: all 10 tests PASS.

- [ ] **Step 3: Commit**

```bash
git add middleware.ts pages/coming-soon.tsx tests/unit/coming-soon-gate.test.ts
git commit -m "feat: add coming-soon gate (launches 2026-05-03, middleware auto-lifts)"
```

---

## Removal instructions (post-launch)

After 2026-05-03, delete both files — no other changes needed:

```bash
git rm middleware.ts pages/coming-soon.tsx
git commit -m "chore: remove coming-soon gate post-launch"
```
