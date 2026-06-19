// @ts-nocheck
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { buildCsp } from "@/server/security/edge";
import { scriptHashes, styleHashes } from "@/server/security/edge/csp-hashes";

const ROOT = resolve(__dirname, "..", "..", "..", "..");

describe("buildCsp", () => {
  it("contains all required directives", () => {
    const csp = buildCsp();
    expect(csp).toContain("default-src");
    expect(csp).toContain("script-src");
    expect(csp).toContain("style-src");
    expect(csp).toContain("style-src-attr");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("img-src");
    expect(csp).toContain("connect-src");
    expect(csp).toContain("frame-src");
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("base-uri 'none'");
    expect(csp).toContain("form-action 'self'");
  });

  it("contains no nonce token", () => {
    expect(buildCsp()).not.toContain("'nonce-");
  });

  it("script-src contains all committed script hashes", () => {
    const scriptSrc = buildCsp().split(";").find(d => d.trim().startsWith("script-src"))!;
    for (const h of scriptHashes) expect(scriptSrc).toContain(`'${h}'`);
  });

  it("style-src contains all committed style hashes", () => {
    const styleSrc = buildCsp().split(";").find(d => d.trim().startsWith("style-src") && !d.trim().startsWith("style-src-attr"))!;
    for (const h of styleHashes) expect(styleSrc).toContain(`'${h}'`);
  });

  it("script-src does not contain unsafe-inline", () => {
    const scriptSrc = buildCsp().split(";").find(d => d.trim().startsWith("script-src"));
    expect(scriptSrc).not.toContain("'unsafe-inline'");
  });

  it("style-src does not contain unsafe-inline", () => {
    const styleSrc = buildCsp().split(";").find(d => d.trim().startsWith("style-src") && !d.trim().startsWith("style-src-attr"));
    expect(styleSrc).not.toContain("'unsafe-inline'");
  });

  it("style-src-attr permits unsafe-inline", () => {
    const styleAttr = buildCsp().split(";").find(d => d.trim().startsWith("style-src-attr"));
    expect(styleAttr).toContain("'unsafe-inline'");
  });

  it("allows Cloudinary in img-src", () => {
    const imgSrc = buildCsp().split(";").find(d => d.trim().startsWith("img-src"));
    expect(imgSrc).toContain("https://res.cloudinary.com");
  });

  it("includes vercel.live and Pusher in preview", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "preview";
    try {
      const csp = buildCsp();
      const scriptSrc = csp.split(";").find(d => d.trim().startsWith("script-src"))!;
      const connectSrc = csp.split(";").find(d => d.trim().startsWith("connect-src"))!;
      const frameSrc = csp.split(";").find(d => d.trim().startsWith("frame-src"))!;
      expect(scriptSrc).toContain("https://vercel.live");
      expect(connectSrc).toContain("https://vercel.live");
      expect(connectSrc).toContain("wss://ws-us3.pusher.com");
      expect(connectSrc).toContain("https://sockjs-us3.pusher.com");
      expect(frameSrc).toContain("https://vercel.live");
    } finally {
      if (prev === undefined) delete process.env.VERCEL_ENV;
      else process.env.VERCEL_ENV = prev;
    }
  });

  it("excludes vercel.live on production", () => {
    const prev = process.env.VERCEL_ENV;
    process.env.VERCEL_ENV = "production";
    try {
      expect(buildCsp()).not.toContain("vercel.live");
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
  for (const d of directives) {
    it(`includes ${d}`, () => expect(cfg).toContain(d));
  }
  it("style-src does not contain unsafe-inline", () => {
    const line = cfg.split("\n").find(l => l.includes("style-src") && !l.includes("style-src-attr"));
    expect(line).toBeDefined();
    expect(line).not.toContain("unsafe-inline");
  });
});
