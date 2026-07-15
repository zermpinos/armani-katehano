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

Security helpers are split by runtime:

| Path                                | Runtime safety            |
|-------------------------------------|---------------------------|
| `src/server/security/edge/csp.ts`     | Edge-safe - CSP nonce, CSP header builder |
| `src/server/security/edge/headers.ts` | Edge-safe - pure header object |
| `src/server/security/node/ssrf.ts`    | Node-only - uses `node:dns` |
| `src/server/security/node/audit-log.ts` | Node-only - structured stdout audit log |
| `src/server/security/node/client-ip.ts` | Node-only - request-shape coupling |

There is **no top-level barrel**. Importers must declare which zone
they're pulling from:

```ts
// proxy.ts (Edge):
import { generateNonce, buildCsp } from "@/server/security/edge";

// pages/api/auth.ts (Node):
import { securityHeaders } from "@/server/security/edge";
import { auditLog, getClientIp } from "@/server/security/node";
```

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

The `EdgeRuntime` half is now inert. It was written when the proxy ran
on Edge; on the Node runtime that global is never defined, so the check
passes and the module loads. It is kept because it costs nothing and
still describes a real constraint if any of this is ever deployed to an
Edge target again.

The runtime guard complements the build-time defenses:

| Layer | Time | Catches |
|-------|------|---------|
| 2.2 - runtime poison pill | First request after a bad deploy | A Node-only module reaching the **browser** bundle |
| 2.3 - ESLint zone (Layer 3 below)        | Editor / pre-merge        | Any direct import from the proxy to Node-only |
| 4   - CI runtime and bundle check         | Build / pre-merge          | A runtime change, or a forbidden dependency reaching the proxy |

Note the poison pill no longer guards the proxy. Its `EdgeRuntime`
branch is dead: the proxy runs on Node, so the global is never defined
and the module loads without complaint. Only its `window` branch, which
covers the client bundle, still fires. For the proxy, 2.3 and 4 are the
enforcement.

If/when the codebase migrates to the App Router, swap the custom
marker import for `import "server-only";` to gain App-Router-aware
bundler enforcement.

### 2.3 ESLint zone - proxy import boundary

`eslint.config.mjs` declares an `import/no-restricted-paths` zone that
forbids `proxy.ts` (and any future `middleware/**`) from
importing any of the Node-only directories listed above. This catches
mistakes in the editor before the developer ever runs `next build`.

Since the runtime no longer enforces anything here, this zone is now the
first line rather than a convenience. Note it restricts paths only: a
bare `import "node:crypto"` in `proxy.ts` is not caught by it, and
section 3 actively requires that spelling.

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

1. Decide if it can run on Edge. If yes (pure functions, no Node
   built-ins, no Prisma), put it under
   `src/server/security/edge/**` or wherever the Edge code lives.
2. Otherwise, put it under one of the Node-only directories above
   and start the file with `import "@/server/_internal/node-only";`.
3. If you need a Node built-in, write `import x from "node:<name>";`.
4. Don't add a top-level barrel that mixes both runtimes.

When you add a file under `middleware/**`:

1. It runs on Edge. Treat it like a browser bundle: no Node built-
   ins, no Prisma.
2. You may import from `src/server/security/edge/**` and from
   `src/domain/**`. Anything else is a build error.
