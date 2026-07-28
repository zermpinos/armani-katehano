import { z } from "zod";

export const SeasonCreateSchema = z.object({
  name:      z.string().min(1).max(100),
  year:      z.coerce.number().int().min(2000).max(2100),
  leagueIds: z.array(z.string().cuid()).max(20).optional(),
});

// An empty date input means "clear it", which is different from omitting the
// field: omitting leaves the stored date alone.
const boundary = z.union([z.literal(""), z.iso.date()])
  .transform(v => (v === "" ? null : new Date(`${v}T00:00:00.000Z`)));

export const SeasonUpdateSchema = z.object({
  startDate: boundary.optional(),
  endDate:   boundary.optional(),
  leagueIds: z.array(z.string().cuid()).max(20).optional(),
});
