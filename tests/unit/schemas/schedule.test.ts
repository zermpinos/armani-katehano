// @ts-nocheck
import { describe, it, expect } from "vitest";
import { ScheduleWriteSchema, ScheduleUpdateSchema } from "@/schemas/schedule";

const BASE = {
  opponent: "Lalades",
  location: "home",
  round: "regular",
};

describe("ScheduleWriteSchema.scheduledFor", () => {
  // Assert the transform OUTPUT, not a `new Date()` round-trip. Round-tripping
  // through `new Date()` only fails the regression on TZ=Athens runtimes; CI
  // runs in TZ=UTC and would silently pass a missing transform.
  it("appends Z to a zoneless datetime so storage is server-TZ-proof", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30:00" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30:00Z");
  });

  it("appends Z to a zoneless datetime missing seconds", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30Z");
  });

  it("leaves an already-zoned (Z) string alone", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30:00.000Z" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30:00.000Z");
  });

  it("leaves an explicit-offset string alone", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30:00+03:00" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30:00+03:00");
  });

  it("applies the same normalisation on update (extend() preserves the transform)", () => {
    const parsed = ScheduleUpdateSchema.parse({ ...BASE, id: "clxxxxxxxxxxxxxxxxxxxxxx", scheduledFor: "2026-06-29T01:30:00" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30:00Z");
  });
});
