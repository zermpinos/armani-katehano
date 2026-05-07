import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Tailwind CSS v3.x (setupContextUtils.js) calls the deprecated `url.parse()`
// from Node's legacy `url` module. Node 24 raises DEP0169 for every call,
// polluting CI build output. Tailwind v3 is no longer actively maintained so
// the fix will never land upstream; a pre-build patch script replaces the
// three-line block with an equivalent that uses the WHATWG URL API (new URL())
// -- the same pattern used for strip-next-polyfills.mjs and
// strip-sentry-tracing.mjs.
const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8"); // eslint-disable-line security/detect-non-literal-fs-filename
}

describe("tailwind url.parse patcher", () => {
  it("ships the patch script", () => {
    expect(
      existsSync(resolve(ROOT, "scripts/patch-tailwind-url.mjs")),
      "scripts/patch-tailwind-url.mjs must exist"
    ).toBe(true);
  });

  it("targets setupContextUtils.js and rewrites it", () => {
    const src = read("scripts/patch-tailwind-url.mjs");
    expect(src).toMatch(/setupContextUtils/);
    expect(src).toMatch(/writeFileSync/);
  });

  it("replaces url.parse with WHATWG new URL()", () => {
    const src = read("scripts/patch-tailwind-url.mjs");
    expect(src).toMatch(/new URL/);
    expect(src).toMatch(/url\.parse/);
  });

  it("is wired into the build before next build runs", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const buildLine = `${pkg.scripts.prebuild ?? ""}\n${pkg.scripts.build ?? ""}`;
    expect(buildLine).toMatch(/patch-tailwind-url/);
  });

  it("is idempotent (uses a sentinel)", () => {
    const src = read("scripts/patch-tailwind-url.mjs");
    expect(src).toMatch(/SENTINEL|sentinel|already patched/i);
  });
});
