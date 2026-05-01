import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "..", "..");

function read(rel: string): string {
  return readFileSync(resolve(ROOT, rel), "utf8");
}

describe("coming-soon gate", () => {
  describe("middleware.ts", () => {
    it("exists at the project root", () => {
      expect(() => read("middleware.ts")).not.toThrow();
    });

    it("compares Date.now() against the 2026-05-03 UTC threshold", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/2026-05-03/);
    });

    it("rewrites to /coming-soon when before launch", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/coming-soon/);
      expect(src).toMatch(/rewrite/i);
    });

    it("excludes _next and api paths from the matcher", () => {
      const src = read("middleware.ts");
      expect(src).toMatch(/_next/);
      expect(src).toMatch(/api/);
    });
  });

  describe("pages/coming-soon.tsx", () => {
    it("exists", () => {
      expect(() => read("pages/coming-soon.tsx")).not.toThrow();
    });

    it("does not import Layout (standalone page)", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).not.toMatch(/import.*Layout/);
    });

    it("displays the launch date text", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/3 May 2026/);
    });

    it("includes the SubscribeForm", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/SubscribeForm/);
    });

    it("uses the high-res logo", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/logohighres/);
    });

    it("sets noindex meta", () => {
      const src = read("pages/coming-soon.tsx");
      expect(src).toMatch(/noindex/);
    });
  });
});
