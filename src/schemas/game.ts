import { z } from "zod";
import { BoxScoreRowSchema } from "./box-score";

export const GameWriteSchema = z.object({
  seasonLeagueId: z.string().cuid(),
  opponent:       z.string().min(1).max(100),
  location:       z.enum(["home", "away"]).default("away"),
  teamScore:      z.coerce.number().int().min(0).max(300),
  opponentScore:  z.coerce.number().int().min(0).max(300),
  result:         z.enum(["W", "L", "T"]),
  playedOn:       z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes:          z.string().max(1000).optional().nullable(),
  sourceUrl:      z.string().url().max(500).optional().nullable(),
  youtubeUrl:     z.string().url().max(500).optional().nullable(),
  boxScore:       z.array(BoxScoreRowSchema).max(20).optional(),
});

export const GameUpdateSchema = GameWriteSchema.omit({ seasonLeagueId: true }).extend({
  gameId:         z.string().cuid(),
  seasonLeagueId: z.string().cuid().optional(),
});

export const GameDeleteSchema = z.object({
  gameId: z.string().cuid(),
});
