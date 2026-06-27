// @ts-nocheck
import { describe, it, expect } from "vitest";
import { ScheduleWriteSchema } from "@/schemas/schedule";

const BASE = {
  opponent: "Lalades",
  location: "home",
  round: "regular",
};

describe("ScheduleWriteSchema.scheduledFor", () => {
  it("normalises a zoneless datetime so UTC digits == input digits regardless of server TZ", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30:00" });
    const d = new Date(parsed.scheduledFor);
    expect(d.toISOString()).toBe("2026-06-29T01:30:00.000Z");
  });

  it("leaves an already-zoned string alone", () => {
    const parsed = ScheduleWriteSchema.parse({ ...BASE, scheduledFor: "2026-06-29T01:30:00.000Z" });
    expect(parsed.scheduledFor).toBe("2026-06-29T01:30:00.000Z");
  });
});
