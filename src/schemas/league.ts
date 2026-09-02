import { z } from "zod";
import { isOrganizationKey } from "@/domain/leagues/organizations";
import { isAllowedHostname } from "@/server/security/node/ssrf";

export function validateListingUrl(url: string | null | undefined): true | string {
  if (!url) return true;
  let parsed: URL;
  try { parsed = new URL(url); } catch { return "listingUrl must be a valid URL"; }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:")
    return "listingUrl must use http or https";
  if (!isAllowedHostname(parsed.hostname))
    return "listingUrl host is not on the scraper allowlist";
  return true;
}

export const LeagueCreateSchema = z.object({
  name:         z.string().min(1).max(100),
  organization: z.string().refine(isOrganizationKey, "organization is not a known stats organization"),
  // What the source site calls this competition, which is what a scraped URL
  // matches on. Absent for a source that does not name the league in its URLs.
  sourceSlug:   z.string().max(50).optional().nullable(),
  listingUrl:   z.string().max(1000).optional().nullable().superRefine((v, ctx) => {
    const result = validateListingUrl(v);
    if (result !== true) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: result });
    }
  }),
  organizer:    z.string().max(100).optional().nullable(),
  level:        z.string().max(50).optional().nullable(),
  seasonId:     z.string().cuid().optional(),
});
