// @ts-nocheck
import { describe, it, expect } from "vitest";
import { generateNonce, buildCsp } from "@/server/security/edge";

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
    expect(csp).toContain("img-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
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
