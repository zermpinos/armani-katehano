export type NavLink = { href: string; label: string };
export type NavGroup = { label: string; links: NavLink[] };

export function buildNav(slug: string | string[] | boolean | undefined): {
  dashboard: NavLink;
  groups: NavGroup[];
} {
  const base = `/admin/${slug}`;
  return {
    dashboard: { href: base, label: "Dashboard" },
    groups: [
      {
        label: "Content",
        links: [
          { href: `${base}/games`,    label: "Games"    },
          { href: `${base}/roster`,   label: "Roster"   },
          { href: `${base}/schedule`, label: "Schedule" },
          { href: `${base}/seasons`,  label: "Seasons"  },
          { href: `${base}/import`,   label: "Import"   },
        ],
      },
      {
        label: "Audience",
        links: [
          { href: `${base}/subscribers`, label: "Subscribers" },
          { href: `${base}/broadcast`,   label: "Broadcast"   },
        ],
      },
      {
        label: "Settings",
        links: [
          { href: `${base}/passkeys`, label: "Passkeys" },
        ],
      },
    ],
  };
}

// Dashboard only matches its exact path; section pages live under it as siblings.
export function isActiveLink(currentPath: string, href: string, dashboardHref: string): boolean {
  if (href === dashboardHref) return currentPath === dashboardHref;
  return currentPath === href || currentPath.startsWith(href + "/");
}
