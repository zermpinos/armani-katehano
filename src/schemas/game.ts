import { z } from "zod";
import { BoxScoreRowSchema } from "./box-score";
import { validateSourceUrl } from "./schedule";

const YOUTUBE_HOSTNAMES = new Set(["youtube.com", "www.youtube.com", "youtu.be"]);

function validateYoutubeUrl(url: string | null | undefined): true | string {
  if (!url) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "youtubeUrl must be a valid URL"; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return "youtubeUrl must use http or https";
  if (!YOUTUBE_HOSTNAMES.has(parsed.hostname))
    return "youtubeUrl host must be youtube.com or youtu.be";
  return true;
}

export const GameWriteSchema = z.object({
  seasonLeagueId: z.string().cuid(),
  opponent:       z.string().min(1).max(100),
  location:       z.enum(["home", "away"]).default("away"),
  teamScore:      z.coerce.number().int().min(0).max(300),
  opponentScore:  z.coerce.number().int().min(0).max(300),
  result:         z.enum(["W", "L", "T"]),
  playedOn:       z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)),
  notes:          z.string().max(1000).optional().nullable(),
  sourceUrl:      z.string().max(500).optional().nullable().superRefine((v, ctx) => {
    const result = validateSourceUrl(v);
    if (result !== true) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
  }),
  youtubeUrl:     z.string().max(500).optional().nullable().superRefine((v, ctx) => {
    const result = validateYoutubeUrl(v);
    if (result !== true) ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
  }),
  boxScore:       z.array(BoxScoreRowSchema).max(20).optional(),
});

export const GameUpdateSchema = GameWriteSchema.omit({ seasonLeagueId: true }).extend({
  gameId:         z.string().cuid(),
  seasonLeagueId: z.string().cuid().optional(),
});

export const GameDeleteSchema = z.object({
  gameId: z.string().cuid(),
});
