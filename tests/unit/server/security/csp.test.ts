// @ts-nocheck
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateNonce, buildCsp } from "@/server/security/edge";

const ROOT = resolve(__dirname, "..", "..", "..", "..");

describe("generateNonce", () => {
  it("returns a non-empty string", () => {
    expect(generateNonce().length).toBeGreaterThan(0);
  });

  it("returns a valid base64 string", () => {
    const nonce = generateNonce();
    expect(() => Buffer.from(nonce, "base64")).not.toThrow();
  });

  it("returns a different value on every call", () => {
    const a = generateNonce();
    const b = generateNonce();
    expect(a).not.toBe(b);
  });
});

describe("buildCsp", () => {
  it("embeds the nonce in script-src", () => {
    const nonce = generateNonce();
    const csp   = buildCsp(nonce);
    expect(csp).toContain(`'nonce-${nonce}'`);
  });

  it("does not contain 'unsafe-inline' in script-src", () => {
    const csp = buildCsp(generateNonce());
    const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("contains all required directives", () => {
    const csp = buildCsp(generateNonce());
    expect(csp).toContain("default-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("style-src-attr");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("style-src-attr permits unsafe-inline for dynamic CSS custom properties", () => {
    const csp = buildCsp(generateNonce());
    const styleAttr = csp.split(";").find(d => d.trim().startsWith("style-src-attr"));
    expect(styleAttr).toContain("'unsafe-inline'");
  });

  it("style-src does not contain unsafe-inline", () => {
    const csp = buildCsp(generateNonce());
    const styleSrc = csp.split(";").find(d => d.trim().startsWith("style-src") && !d.trim().startsWith("style-src-attr"));
    expect(styleSrc).not.toContain("'unsafe-inline'");
  });

  it("allows Sentry CDN in script-src", () => {
    const csp       = buildCsp(generateNonce());
    const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src"));
    expect(scriptSrc).toContain("https://*.sentry-cdn.com");
  });

  it("allows Cloudinary in img-src", () => {
    const csp    = buildCsp(generateNonce());
    const imgSrc = csp.split(";").find(d => d.trim().startsWith("img-src"));
    expect(imgSrc).toContain("https://res.cloudinary.com");
  });

  it("allows Sentry ingestion in connect-src", () => {
    const csp        = buildCsp(generateNonce());
    const connectSrc = csp.split(";").find(d => d.trim().startsWith("connect-src"));
    expect(connectSrc).toContain("https://*.sentry.io");
  });

  it("allows vercel.live in script-src and connect-src on preview deployments", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    try {
      const csp        = buildCsp(generateNonce());
      const scriptSrc  = csp.split(";").find(d => d.trim().startsWith("script-src"));
      const connectSrc = csp.split(";").find(d => d.trim().startsWith("connect-src"));
      expect(scriptSrc).toContain("https://vercel.live");
      expect(connectSrc).toContain("https://vercel.live");
    } finally {
      if (prev === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prev;
    }
  });

  it("excludes vercel.live on production deployments", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    try {
      const csp = buildCsp(generateNonce());
      expect(csp).not.toContain("vercel.live");
    } finally {
      if (prev === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prev;
    }
  });
});

describe("next.config.mjs fallback CSP", () => {
  const cfg = readFileSync(resolve(ROOT, "next.config.mjs"), "utf8");

  const directives = [
    "style-src-attr 'unsafe-inline'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "base-uri 'none'",
    "form-action 'self'",
  ];

  for (const directive of directives) {
    it(`includes ${directive}`, () => {
      expect(cfg).toContain(directive);
    });
  }

  it("style-src does not contain unsafe-inline", () => {
    const lines = cfg.split("\n");
    const styleSrcLine = lines.find(
      l => l.includes("style-src") && !l.includes("style-src-attr")
    );
    expect(styleSrcLine).toBeDefined();
    expect(styleSrcLine).not.toContain("unsafe-inline");
  });
});
