import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { formatGameDateTime } from "@/client/home/final-four-popup";

// CI runs in UTC, where reading the stored digits as local time happens to look right.
const savedTz = process.env.TZ;
beforeAll(() => { process.env.TZ = "Europe/Athens"; });
afterAll(() => { if (savedTz === undefined) delete process.env.TZ; else process.env.TZ = savedTz; });

describe("formatGameDateTime", () => {
  it("shows the stored Athens digits, not the visitor's local time", () => {
    expect(formatGameDateTime("2026-11-14T23:30:00.000Z")).toMatch(/14 Nov 2026 · 23:30$/);
  });
});
