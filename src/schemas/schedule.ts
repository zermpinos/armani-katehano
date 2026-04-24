import { z } from "zod";
import { isAllowedHostname } from "@/server/security/ssrf";
import { detectLeagueSlug } from "@/domain/calendar/greek-date";

function validateSourceUrl(url: string | null | undefined): true | string {
  if (!url) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "sourceUrl must be a valid URL"; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return "sourceUrl must use http or https";
  if (!isAllowedHostname(parsed.hostname))
    return "sourceUrl host is not on the scraper allowlist";
  if (!detectLeagueSlug(url))
    return "sourceUrl does not contain a recognised league slug (rookie, bc6, wintercup)";
  return true;
}

export const ScheduleWriteSchema = z.object({
  opponent:     z.string().min(1).max(100),
  scheduledFor: z.string().datetime({ offset: true }).or(z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/)),
  location:     z.enum(["home", "away"]).default("home"),
  competition:  z.string().max(200).optional().nullable(),
  notes:        z.string().max(1000).optional().nullable(),
  sourceUrl:    z.string().max(1000).optional().nullable().superRefine((v, ctx) => {
    const result = validateSourceUrl(v);
    if (result !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
    }
  }),
});

export const ScheduleUpdateSchema = ScheduleWriteSchema.extend({
  id: z.string().cuid(),
});

export const ScheduleDeleteSchema = z.object({
  id: z.string().cuid(),
});
