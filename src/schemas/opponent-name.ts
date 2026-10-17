import { z } from "zod";

export const OpponentNameSchema = z.object({
  scrapedName: z.string().trim().min(1).max(100),
  displayName: z.string().trim().min(1).max(100),
});
