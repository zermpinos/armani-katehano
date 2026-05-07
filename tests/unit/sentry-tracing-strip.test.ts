import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Sentry's @sentry/nextjs client `init()` statically imports
// `browserTracingIntegration` (see node_modules/@sentry/nextjs/build/esm/
// client/index.js line 10) and pushes it into the customDefaultIntegrations
// list inside an `if (typeof __SENTRY_TRACING__ === 'undefined' ||
// __SENTRY_TRACING__)` branch. Setting `defaultIntegrations: false` at the
// call site stops it from running, but the static import keeps the module
// (and its transitive deps) in the client bundle.
//
// The Sentry SDK ships a magic identifier `__SENTRY_TRACING__` that
// bundlers can text-replace with `false` to dead-code the conditional. The
// official Sentry Next.js plugin only injects that define on the webpack
// path; Turbopack (Next 16's default) ignores it. The strip script does
// the replacement in-place against the SDK source so any bundler sees a
// dead branch.
const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8"); // eslint-disable-line security/detect-non-literal-fs-filename
}

describe("sentry tracing stripper", () => {
  it("ships the strip script", () => {
    expect(
      existsSync(resolve(ROOT, "scripts/strip-sentry-tracing.mjs")),
      "scripts/strip-sentry-tracing.mjs must exist"
    ).toBe(true);
  });

  it("replaces the __SENTRY_TRACING__ identifier with `false`", () => {
    const src = read("scripts/strip-sentry-tracing.mjs");
    expect(src).toMatch(/__SENTRY_TRACING__/);
    // Must rewrite, not just read.
    expect(src).toMatch(/writeFileSync/);
    // Must touch the @sentry/nextjs client init (the source of the static
    // import) and the @sentry/core hasSpansEnabled helper (used at runtime
    // by the SDK to short-circuit any tracing call sites).
    expect(src).toMatch(/@sentry\/nextjs.*client.*index\.js/);
    expect(src).toMatch(/@sentry\/core.*hasSpansEnabled\.js/);
  });

  it("is wired into the build before next build runs", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const buildLine = `${pkg.scripts.prebuild ?? ""}\n${pkg.scripts.build ?? ""}`;
    expect(buildLine).toMatch(/strip-sentry-tracing/);
  });

  it("is idempotent (uses a sentinel)", () => {
    const src = read("scripts/strip-sentry-tracing.mjs");
    // Mirrors the strip-next-polyfills.mjs pattern: a sentinel comment lets
    // re-runs short-circuit without re-rewriting.
    expect(src).toMatch(/SENTINEL|sentinel|already stripped/i);
  });
});
