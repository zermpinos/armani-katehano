import { z } from "zod";

const PlayerSlotSchema = z.object({
  playerId: z.string().cuid(),
  note:     z.string().max(200).optional().nullable(),
});

// Admin: players array is required and must have at least one entry.
export const AnnouncementWriteSchema = z.object({
  upcomingGameId: z.string().cuid(),
  message:        z.string().max(1000).optional().nullable(),
  players:        z.array(PlayerSlotSchema).min(1).max(20),
});

// Coach: players is optional (resend path skips it); adds resend flag.
export const CoachAnnouncementWriteSchema = z.object({
  upcomingGameId: z.string().cuid(),
  message:        z.string().max(1000).optional().nullable(),
  players:        z.array(PlayerSlotSchema).max(20).optional(),
  resend:         z.boolean().optional(),
});

export const AnnouncementDeleteSchema = z.object({
  upcomingGameId: z.string().cuid(),
});
