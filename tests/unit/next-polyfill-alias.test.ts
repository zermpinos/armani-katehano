import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression guard for the Next.js client-polyfill stripper. Next 16's client
// runtime hardcodes `require("../build/polyfills/polyfill-module")` in
// node_modules/next/dist/client/index.js, which ships ~14 KiB of conditional
// polyfills for browsers below the production browserslist target (Chrome
// >=96, Firefox >=94, Safari >=15.4, Edge >=96). Every method is natively
// supported there, so the bytes are dead code on every page load.
//
// Turbopack (Next 16's default build bundler) ignores resolveAlias for the
// relative `require("../build/polyfills/polyfill-module")` from inside
// node_modules, so a pre-build script overwrites the file with the empty
// stub. The webpack alias in next.config.mjs covers webpack-only runs.
const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("next polyfill stripper", () => {
  it("ships the empty polyfill stub", () => {
    const stub = resolve(ROOT, "lib", "empty-polyfill-module.js");
    expect(existsSync(stub), "lib/empty-polyfill-module.js must exist").toBe(true);
    const src = read("lib/empty-polyfill-module.js");
    // No polyfill assignments allowed — anything beyond comments and a bare
    // module-export sentinel defeats the stub.
    expect(src).not.toMatch(/Array\.prototype\.|Object\.fromEntries|Object\.hasOwn|String\.prototype\.trim/);
  });

  it("aliases the polyfill module in next.config.mjs (webpack path)", () => {
    const cfg = read("next.config.mjs");
    expect(cfg).toMatch(/polyfill-module/);
    expect(cfg).toMatch(/empty[-_]polyfill[-_]module/);
  });

  it("ships a prebuild script that strips the polyfill (Turbopack path)", () => {
    expect(
      existsSync(resolve(ROOT, "scripts/strip-next-polyfills.mjs")),
      "scripts/strip-next-polyfills.mjs must exist"
    ).toBe(true);
    const src = read("scripts/strip-next-polyfills.mjs");
    expect(src).toMatch(/polyfill-module/);
    expect(src).toMatch(/writeFileSync/);
  });

  it("wires the strip script into the build", () => {
    const pkg = JSON.parse(read("package.json")) as {
      scripts: Record<string, string>;
    };
    const buildLine = `${pkg.scripts.prebuild ?? ""}\n${pkg.scripts.build ?? ""}`;
    expect(buildLine).toMatch(/strip-next-polyfills/);
  });
});
