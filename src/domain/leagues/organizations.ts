// The organizations whose published stats we parse. Keyed by the value stored
// in League.organization. Adding one always means a new parser, an identity
// match and an SSRF allowlist entry, so this is code rather than a table.
export const ORGANIZATIONS = {
  basketcity: {
    name:  "BasketCity",
    hosts: ["basketcity.sportstats.gr", "reports.sportstats.gr"],
  },
  jumpball: {
    name:  "Jumpball",
    hosts: ["www.jumpball.com.gr"],
  },
} as const;

export type OrganizationKey = keyof typeof ORGANIZATIONS;

export const ORGANIZATION_KEYS = Object.keys(ORGANIZATIONS) as OrganizationKey[];

export function isOrganizationKey(value: unknown): value is OrganizationKey {
  return typeof value === "string" && Object.hasOwn(ORGANIZATIONS, value);
}

export function organizationName(key: string): string {
  const hit = Object.entries(ORGANIZATIONS).find(([k]) => k === key);
  return hit ? hit[1].name : key;
}

// Same host semantics as the SSRF allowlist: exact match or a subdomain. Being
// allowlisted does not imply an organization, so hosts we fetch but cannot
// parse resolve to null here.
export function organizationForHost(hostname: string): OrganizationKey | null {
  const h = hostname.toLowerCase();
  const hit = Object.entries(ORGANIZATIONS).find(([, org]) =>
    org.hosts.some(entry => h === entry || h.endsWith("." + entry)),
  );
  return hit ? (hit[0] as OrganizationKey) : null;
}

export function organizationForUrl(url: string | null | undefined): OrganizationKey | null {
  if (!url) return null;
  try { return organizationForHost(new URL(url).hostname); }
  catch { return null; }
}
