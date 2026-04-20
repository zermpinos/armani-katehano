import { z } from "zod";

export const LeagueCreateSchema = z.object({
  name:      z.string().min(1).max(100),
  organizer: z.string().max(100).optional().nullable(),
  level:     z.string().max(50).optional().nullable(),
  seasonId:  z.string().cuid().optional(),
});
