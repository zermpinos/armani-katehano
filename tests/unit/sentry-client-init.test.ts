import { describe, it, expect } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

// Regression guard for the Sentry client init that bloated TBT (PageSpeed perf
// dropped from ~90 to 72 with Total Blocking Time at 1,260ms).
//
// In Next.js with @sentry/nextjs >= 9, instrumentation-client.{js,ts} is the
// only supported entry for client init. The legacy sentry.client.config.js
// still gets bundled if present, causing a *second* Sentry.init() call. That
// double-init bloats the framework chunk (BrowserTracing + Replay are bundled
// twice) and the SDK warns at runtime about it. The first "fix" landed the
// safe values in sentry.client.config.js -- the dead file -- which is why perf
// did not actually recover.
const ROOT = resolve(__dirname, "..", "..");

const CLIENT_CANDIDATES = [
  "instrumentation-client.js",
  "instrumentation-client.ts",
  "sentry.client.config.js",
  "sentry.client.config.ts",
];

function readIfExists(rel: string): string | null {
  const p = resolve(ROOT, rel);
  return existsSync(p) ? readFileSync(p, "utf8") : null; // nosemgrep
}

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "")
    .replace(/(^|[^:])\/\/.*$/gm, "$1");
}

function countSentryInit(src: string): number {
  // Look for the actual call shape (`Sentry.init({...`) so prose mentions of
  // `Sentry.init()` in comments don't count.
  return (stripComments(src).match(/Sentry\.init\s*\(\s*\{/g) ?? []).length;
}

describe("sentry client init", () => {
  it("calls Sentry.init exactly once across all client entry files", () => {
    const total = CLIENT_CANDIDATES.reduce((acc, rel) => {
      const src = readIfExists(rel);
      return src ? acc + countSentryInit(src) : acc;
    }, 0);
    expect(total).toBe(1);
  });

  it("disables tracing on the client (tracesSampleRate: 0)", () => {
    const src =
      readIfExists("instrumentation-client.js") ??
      readIfExists("instrumentation-client.ts");
    expect(src, "instrumentation-client.{js,ts} must exist").not.toBeNull();
    expect(src!).toMatch(/tracesSampleRate:\s*0(?!\.)/);
  });

  it("disables replay on the client (replaysSessionSampleRate: 0)", () => {
    const src =
      readIfExists("instrumentation-client.js") ??
      readIfExists("instrumentation-client.ts");
    expect(src!).toMatch(/replaysSessionSampleRate:\s*0(?!\.)/);
  });

  it("opts out of default PII (sendDefaultPii: false)", () => {
    const src =
      readIfExists("instrumentation-client.js") ??
      readIfExists("instrumentation-client.ts");
    expect(src!).toMatch(/sendDefaultPii:\s*false/);
  });

  // Sentry's default integrations bundle BrowserTracing, Replay,
  // BrowserSession, BrowserApiErrors, etc. -- tens of KiB of code that runs
  // even when tracesSampleRate / replaysSessionSampleRate are 0. Disabling
  // the defaults and re-adding only globalHandlers (uncaught-exception
  // capture is the whole point of Sentry on the client) keeps error
  // reporting working while dropping the bundle weight.
  it("disables default integrations and keeps an explicit minimal set", () => {
    const src =
      readIfExists("instrumentation-client.js") ??
      readIfExists("instrumentation-client.ts");
    const stripped = stripComments(src!);
    expect(stripped).toMatch(/defaultIntegrations:\s*false/);
    expect(stripped).toMatch(/globalHandlersIntegration/);
  });
});
