import { z } from "zod";
import { POSITIONS } from "@/domain/players/positions";
import { isOwnCloudinaryUrl } from "@/domain/shared/cloudinary";

export const PlayerWriteSchema = z.object({
  name:     z.string().min(1).max(100),
  number:   z.coerce.number().int().min(0).max(99),
  position: z.enum(POSITIONS as [string, ...string[]]),
  height:   z.string().max(10).optional().nullable(),
  weight:   z.string().max(10).optional().nullable(),
  photoUrl: z.string().url().max(255)
    .refine(isOwnCloudinaryUrl, { message: "photoUrl must be an image in the team's Cloudinary account" })
    .optional().nullable(),
  contactEmail: z.string().email().max(200).optional().nullable(),
});

export const PlayerUpdateSchema = PlayerWriteSchema.extend({
  playerId: z.string().cuid(),
  isActive: z.boolean().optional(),
});
