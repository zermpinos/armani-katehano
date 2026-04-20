import { z } from "zod";

export const ScheduleWriteSchema = z.object({
  opponent:     z.string().min(1).max(100),
  scheduledFor: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  location:     z.enum(["home", "away"]).default("home"),
  competition:  z.string().max(200).optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
});

export const ScheduleUpdateSchema = ScheduleWriteSchema.extend({
  id: z.string().cuid(),
});

export const ScheduleDeleteSchema = z.object({
  id: z.string().cuid(),
});
