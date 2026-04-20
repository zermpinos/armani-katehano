import { z } from "zod";
import { POSITIONS } from "@/domain/players/positions";

export const PlayerWriteSchema = z.object({
  name:     z.string().min(1).max(100),
  number:   z.coerce.number().int().min(0).max(99),
  position: z.enum(POSITIONS as [string, ...string[]]),
  height:   z.string().max(10).optional().nullable(),
  weight:   z.string().max(10).optional().nullable(),
  photoUrl: z.string().max(255).optional().nullable(),
});

export const PlayerUpdateSchema = PlayerWriteSchema.extend({
  playerId: z.string().cuid(),
  isActive: z.boolean().optional(),
});
