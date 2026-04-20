import { z } from "zod";

export const ScrapeSchema = z.object({
  url: z.string().url().max(500),
});
