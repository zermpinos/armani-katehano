# Architecture

This document is the source of truth for layer and runtime boundaries.
Every rule below is enforced automatically - by ESLint, by the build, or
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

## 2. Runtime split: proxy vs the rest

`proxy.ts` runs on the **Node runtime**, and so does the rest of the
app. Next 16 renamed middleware to proxy and moved it to Node; there
is no Edge option to opt back into, and `runtime: "edge"` is rejected
at build time with *"Proxy always runs on Node.js runtime"*. Section 4
asserts the runtime on every build so that a future upgrade moving it
again is caught rather than absorbed.

Earlier revisions of this document described the proxy as Edge-bound
and treated Node built-ins there as fatal. That was true of the Vercel
Edge runtime and is not true now: nothing about the runtime stops
`proxy.ts` importing `node:crypto`.

The separation below is therefore a **deliberate constraint, not a
runtime one**. The proxy sits on every matched request, so it stays
small and does not reach the database directly. Enforcement is the
ESLint zone (2.3) and the post-build check (4).

### 2.1 Structural - `src/server/security/{edge,node}/`

Security helpers are split by weight. The `edge/` name is historical: it
means *cheap enough for the proxy to import*, not *runs on Edge*.

| Path                                | Proxy may import          |
|-------------------------------------|---------------------------|
| `src/server/security/edge/csp.ts`     | yes - CSP header builder, pure |
| `src/server/security/edge/headers.ts` | yes - pure header object |
| `src/server/security/node/ssrf.ts`    | no - `node:dns` lookups per call |
| `src/server/security/node/audit-log.ts` | no - writes the audit log |
| `src/server/security/node/client-ip.ts` | no - request-shape coupling |

There is **no top-level barrel**. Importers must declare which zone
they're pulling from:

```ts
// proxy.ts:
import { buildCsp } from "@/server/security/edge/csp";

// pages/api/auth.ts (Node):
import { securityHeaders } from "@/server/security/edge";
import { auditLog, getClientIp } from "@/server/security/node";
```

`src/server/auth/session.ts` is the one exception outside this tree that
the proxy may import: it verifies the admin session cookie, and it costs
`node:crypto` and nothing else. It must be imported by path. The
`@/server/auth` barrel re-exports `./passkey`, so importing that instead
would drag `@simplewebauthn/server` and prisma onto every request. 2.3
rejects it, and 4 fails the build if it ever gets through.

### 2.2 Runtime marker - `import "@/server/_internal/node-only"`

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
condition - it only works inside App Router server components, and
this codebase is on the Pages Router. The marker module
(`src/server/_internal/node-only.ts`) throws at module load time if
it ever gets bundled into the browser (`typeof window !== "undefined"`)
or the Vercel Edge runtime (`typeof EdgeRuntime !== "undefined"`).
An import chain that reaches the client bundle therefore crashes on
first request, with a clear error pointing the developer at the rule.

The `EdgeRuntime` half is inert. It was written when the proxy ran on
Edge; on the Node runtime that global is never defined, so the check
passes and the module loads. Only the `window` half, which covers the
client bundle, still fires. The dead half is kept because it costs
nothing and would matter again on an Edge target.

This is why `proxy.ts` can import `src/server/auth/session.ts` even
though that file carries the marker: the proxy is neither a browser nor
an Edge bundle, so neither branch throws. The marker is not what keeps
the proxy small. 2.3 and 4 are.

The runtime guard complements the build-time defenses:

| Layer | Time | Catches |
|-------|------|---------|
| 2.2 - runtime poison pill | First request after a bad deploy | A Node-only module reaching the **browser** bundle |
| 2.3 - ESLint zone (Layer 3 below)        | Editor / pre-merge        | A proxy import outside its allow-list |
| 4   - CI runtime and bundle check         | Build / pre-merge          | A runtime change, or a forbidden dependency reaching the proxy |

If/when the codebase migrates to the App Router, swap the custom
marker import for `import "server-only";` to gain App-Router-aware
bundler enforcement.

### 2.3 ESLint zone - proxy import boundary

`eslint.config.mjs` declares two `import/no-restricted-paths` zones over
`proxy.ts` (and any future `middleware/**`). The first forbids the
Node-only directories listed above. The second forbids `src/server/auth`
with a single exception, `./session.ts`, so the proxy can verify the
session cookie without the barrel dragging passkeys and prisma in behind
it. Both catch mistakes in the editor, before `next build` runs.

Since the runtime enforces nothing here, these zones are the first line
rather than a convenience. Two gaps are worth knowing:

- They restrict **paths only**. A bare `import "node:crypto"` in
  `proxy.ts` is not caught, and section 3 actively requires that
  spelling. Weight, not the `node:` prefix, is the thing being guarded.
- They cannot see a transitive pull. Section 4 covers that, by reading
  the built chunk graph rather than the source.

---

## 3. Node built-in imports - `node:` protocol mandatory

Every Node built-in must be imported with the `node:` prefix:

```ts
// ✅ correct
import crypto from "node:crypto";
import dns    from "node:dns";

// ❌ wrong - flagged by ESLint, will fail CI
import crypto from "crypto";
```

Why: Node 18+ resolves `node:crypto` synchronously to the built-in
module and never to an npm package of the same name. This is a
cheap, durable mitigation against typosquatting and dependency-
confusion attacks targeting well-known module names. Enforced by
`no-restricted-imports` in `eslint.config.mjs`.

---

## 4. CI assertion on the proxy bundle

`scripts/check-proxy-bundle.mjs` runs after `next build` and asserts two
things, failing the build on either.

**The runtime.** `.next/server/functions-config-manifest.json` must report
`"/_middleware"` on the `nodejs` runtime. This is the assumption sections
2 and 3 are written against, and it has moved once already without anyone
noticing.

**The dependencies.** The proxy must not pull in Prisma, the Neon driver,
`@simplewebauthn/server`, `bcryptjs`, or `nodemailer`. It runs on every
matched request, so it stays small and talks to the database only through
an API route.

Two details matter, because getting either wrong makes this check pass
while proving nothing:

- `.next/server/middleware.js` is a Turbopack **loader stub** of a few
  hundred bytes. The code lives in the chunks it names, so the script
  resolves that graph rather than pattern-matching file paths, and refuses
  to report success if the graph does not resolve.
- Package names are matched by prefix and cross-checked against
  `middleware.js.nft.json`, the build's own dependency trace. An exact
  string match is not enough: Prisma 7 is emitted under a hash-suffixed
  name such as `@prisma/client-2c3a283f134fdcb6`.

Wired into CI via the `build` job in `.github/workflows/ci.yml`.

---

## 5. Adding new modules

When you add a file under `src/server/**`:

1. Decide whether the proxy could ever need it. If it is pure and
   cheap (no Prisma, no network, no per-call I/O), it can live under
   `src/server/security/edge/**`.
2. Otherwise put it under one of the Node-only directories above and
   start the file with `import "@/server/_internal/node-only";`.
3. If you need a Node built-in, write `import x from "node:<name>";`.
4. Don't add a top-level barrel that mixes the two zones. A barrel is
   how a cheap import turns into an expensive one without anyone
   noticing.

When you add a file under `middleware/**`, or edit `proxy.ts`:

1. It runs on the Node runtime, on every matched request. Nothing is
   forbidden by the runtime, so the budget is yours to keep: no
   Prisma, no database, nothing heavy.
2. You may import from `src/server/security/edge/**`,
   `src/server/auth/session`, and `src/domain/**`. Anything else is a
   lint error, and section 4 fails the build if it arrives
   transitively.
