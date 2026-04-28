/**
 * Pages-Router equivalent of the `server-only` npm package.
 *
 * The official `server-only` package is gated on the `react-server` export
 * condition, which only fires inside App Router server components -- making
 * it unusable in a Pages Router codebase (it throws unconditionally during
 * any non-RSC build, including SSR and API routes).
 *
 * This shim is a pure runtime poison pill: importing it from a module that
 * gets bundled into a non-Node target -- the client bundle (browser) or the
 * Vercel Edge runtime -- causes the module to throw at load time.
 *
 * Detection:
 *   • `typeof window !== "undefined"`  -> client bundle (browser).
 *   • `typeof EdgeRuntime !== "undefined"` -> Vercel Edge runtime (V8 isolate
 *     defines an `EdgeRuntime` global containing the runtime version string).
 *
 * Build-time enforcement of the same boundary lives in `eslint.config.mjs`
 * (Layer 3) and `scripts/check-middleware-bundle.mjs` (Layer 4). This
 * runtime guard is a third line of defense in case those are ever bypassed.
 */

declare const EdgeRuntime: string | undefined;

if (typeof window !== "undefined" || typeof EdgeRuntime !== "undefined") {
  throw new Error(
    "[node-only] This module must not be bundled into a client or Edge bundle. " +
    "See docs/architecture.md §2 for the runtime-split rules."
  );
}

export {};
