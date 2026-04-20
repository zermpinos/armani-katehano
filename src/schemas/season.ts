import { z } from "zod";

export const SeasonCreateSchema = z.object({
  name:      z.string().min(1).max(100),
  year:      z.coerce.number().int().min(2000).max(2100),
  leagueIds: z.array(z.string().cuid()).max(20).optional(),
});
