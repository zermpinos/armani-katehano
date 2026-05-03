# Architecture

This document is the source of truth for layer and runtime boundaries.
Every rule below is enforced automatically -- by ESLint, by the build, or
both. If you find yourself fighting a rule, fix the import shape rather
than disabling the rule.

---

## 1. Layer boundaries

The codebase is split into five layers. Imports may only flow downward.

```
pages, proxy        ← entry points
   │
   ├── src/features  ← page-scoped components, hooks
   │      │
   │      └── src/components, src/client  ← UI primitives
   │
   ├── src/server    ← Node-only business logic, DB, auth, integrations
   │
   └── src/domain    ← pure logic; no I/O, no React, no Next, no Prisma
```

Enforced by `eslint.config.mjs` -> `import/no-restricted-paths`:

| Target              | Cannot import from                                   |
|---------------------|------------------------------------------------------|
| `components/**`, `src/components/**` | `src/server/**`, `src/features/**`  |
| `src/client/**`     | `src/server/**`                                      |
| `src/features/**`   | `src/server/**`                                      |
| `src/domain/**`     | `src/server/**`, `src/components/**`, `src/features/**` |
| `proxy.ts`, `middleware/**` | `src/server/security/node/**`, `src/server/db/**`, `src/server/auth/**`, `src/server/services/**`, `src/server/integrations/**` |

If a client component needs server data, it goes through an API route in
`pages/api/**`, not through a direct import.

---

## 2. Runtime split: Edge vs Node

`proxy.ts` runs on the Vercel **Edge runtime**, which is V8-isolate-
based and has **no Node built-ins** (`dns`, `crypto`, `fs`, `net`, ...).
The rest of the app runs on the **Node runtime**.

This boundary is non-negotiable: pulling a Node module into the Edge
bundle either fails the build or -- worse -- silently ships a broken
worker. Three layers of defense keep them apart.

### 2.1 Structural -- `src/server/security/{edge,node}/`

Security helpers are split by runtime:

| Path                                | Runtime safety            |
|-------------------------------------|---------------------------|
| `src/server/security/edge/csp.ts`     | Edge-safe -- CSP nonce, CSP header builder |
| `src/server/security/edge/headers.ts` | Edge-safe -- pure header object |
| `src/server/security/node/ssrf.ts`    | Node-only -- uses `node:dns` |
| `src/server/security/node/audit-log.ts` | Node-only -- Sentry capture |
| `src/server/security/node/client-ip.ts` | Node-only -- request-shape coupling |

There is **no top-level barrel**. Importers must declare which zone
they're pulling from:

```ts
// proxy.ts (Edge):
import { generateNonce, buildCsp } from "@/server/security/edge";

// pages/api/auth.ts (Node):
import { securityHeaders } from "@/server/security/edge";
import { auditLog, getClientIp } from "@/server/security/node";
```

### 2.2 Runtime marker -- `import "@/server/_internal/node-only"`

Every file under the following paths begins with the Node-only marker
import:

- `src/server/security/node/**`
- `src/server/db/**`
- `src/server/auth/**`
- `src/server/services/**`
- `src/server/integrations/**`

```ts
import "@/server/_internal/node-only";
```

We use a custom marker module rather than the npm `server-only`
package because `server-only` is gated on the `react-server` export
condition -- it only works inside App Router server components, and
this codebase is on the Pages Router. The marker module
(`src/server/_internal/node-only.ts`) throws at module load time if
it ever gets bundled into the browser (`typeof window !== "undefined"`)
or the Vercel Edge runtime (`typeof EdgeRuntime !== "undefined"`).
Any forbidden import chain therefore crashes on first request, with
a clear error pointing the developer at the rule.

The runtime guard complements the build-time defenses:

| Layer | Time | Catches |
|-------|------|---------|
| 2.2 -- runtime poison pill | First request after a bad deploy | Anything that bypassed Layers 2.1, 3, and 4 |
| 2.3 -- ESLint zone (Layer 3 below)        | Editor / pre-merge        | Any direct import from middleware to Node-only |
| 4   -- CI bundle scan                      | Build / pre-merge          | Any indirect import that ended up in the Edge bundle |

If/when the codebase migrates to the App Router, swap the custom
marker import for `import "server-only";` to gain App-Router-aware
bundler enforcement.

### 2.3 ESLint zone -- Edge import boundary

`eslint.config.mjs` declares an `import/no-restricted-paths` zone that
forbids `proxy.ts` (and any future `middleware/**`) from
importing any of the Node-only directories listed above. This catches
mistakes in the editor before the developer ever runs `next build`.

---

## 3. Node built-in imports -- `node:` protocol mandatory

Every Node built-in must be imported with the `node:` prefix:

```ts
// ✅ correct
import crypto from "node:crypto";
import dns    from "node:dns";

// ❌ wrong -- flagged by ESLint, will fail CI
import crypto from "crypto";
```

Why: Node 18+ resolves `node:crypto` synchronously to the built-in
module and never to an npm package of the same name. This is a
cheap, durable mitigation against typosquatting and dependency-
confusion attacks targeting well-known module names. Enforced by
`no-restricted-imports` in `eslint.config.mjs`.

---

## 4. CI assertion on the middleware bundle

`scripts/check-middleware-bundle.mjs` runs after `next build` and
greps the produced `.next/server/middleware.js` for known Node
built-in identifiers. If any are present, the build is failed. This
is the audit-grade backstop in case Next.js, Webpack, or a future
refactor introduces a new code path that bypasses the three layers
above.

Wired into CI via the `build` job in `.github/workflows/ci.yml`.

---

## 5. Adding new modules

When you add a file under `src/server/**`:

1. Decide if it can run on Edge. If yes (pure functions, no Node
   built-ins, no Prisma, no Sentry server), put it under
   `src/server/security/edge/**` or wherever the Edge code lives.
2. Otherwise, put it under one of the Node-only directories above
   and start the file with `import "@/server/_internal/node-only";`.
3. If you need a Node built-in, write `import x from "node:<name>";`.
4. Don't add a top-level barrel that mixes both runtimes.

When you add a file under `middleware/**`:

1. It runs on Edge. Treat it like a browser bundle: no Node built-
   ins, no Prisma, no `@sentry/nextjs` server side.
2. You may import from `src/server/security/edge/**` and from
   `src/domain/**`. Anything else is a build error.
