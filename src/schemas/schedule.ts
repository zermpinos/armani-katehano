import { z } from "zod";
import { isAllowedHostname } from "@/server/security/ssrf";
import { detectLeagueSlug } from "@/domain/calendar/greek-date";

const LISTING_HOSTNAME = "basketcity.sportstats.gr";
const LISTING_PATH_RE  = /^\/[^/]+\/teamdetails\/id\/[0-9a-f-]{36}\/?$/i;

function validateSourceUrl(url: string | null | undefined): true | string {
  if (!url) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "sourceUrl must be a valid URL"; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return "sourceUrl must use http or https";
  if (!isAllowedHostname(parsed.hostname))
    return "sourceUrl host is not on the scraper allowlist";
  if (!detectLeagueSlug(url))
    return "sourceUrl must be a sportstats game URL containing /men/ or /winter-cup/ (or a recognised league slug)";
  return true;
}

function validateListingUrl(url: string | null | undefined): true | string {
  if (!url) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "listingUrl must be a valid URL"; }
  if (parsed.protocol !== "https:")
    return "listingUrl must use https";
  if (parsed.hostname !== LISTING_HOSTNAME)
    return `listingUrl host must be ${LISTING_HOSTNAME}`;
  if (!LISTING_PATH_RE.test(parsed.pathname))
    return "listingUrl must look like /<competition>/teamdetails/id/<UUID>";
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
  listingUrl:   z.string().max(1000).optional().nullable().superRefine((v, ctx) => {
    const result = validateListingUrl(v);
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
