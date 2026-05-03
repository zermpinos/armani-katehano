import { z } from "zod";

export const OpponentAliasWriteSchema = z.object({
  myName:      z.string().min(1).max(100),
  listingName: z.string().min(1).max(100),
  notes:       z.string().max(500).optional().nullable(),
});

export const OpponentAliasUpdateSchema = OpponentAliasWriteSchema.extend({
  id: z.string().cuid(),
});

export const OpponentAliasDeleteSchema = z.object({
  id: z.string().cuid(),
});
