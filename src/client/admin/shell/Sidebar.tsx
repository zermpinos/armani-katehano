import Link from "next/link";
import type { NavLink, NavGroup } from "./nav";
import { isActiveLink } from "./nav";

type Props = {
  dashboard:   NavLink;
  groups:      NavGroup[];
  currentPath: string;
  onLogout?:   () => void;
};

export function Sidebar({ dashboard, groups, currentPath, onLogout }: Props) {
  return (
    <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-[240px] bg-ak-surface border-r border-ak-border z-40">
      <div className="px-6 py-5 border-b border-ak-border">
        <div className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase">AK Admin</div>
      </div>
      <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
        <SidebarLink link={dashboard} currentPath={currentPath} dashboardHref={dashboard.href} />
        {groups.map(group => (
          <div key={group.label} className="mt-5">
            <div className="px-3 mb-1 text-[9px] font-black tracking-[0.18em] uppercase text-ak-text-dim">
              {group.label}
            </div>
            <div className="flex flex-col">
              {group.links.map(link => (
                <SidebarLink
                  key={link.href}
                  link={link}
                  currentPath={currentPath}
                  dashboardHref={dashboard.href}
                />
              ))}
            </div>
          </div>
        ))}
      </nav>
      {onLogout && (
        <div className="px-3 py-4 border-t border-ak-border">
          <button
            onClick={onLogout}
            className="w-full px-3 py-[8px] text-[10px] font-black tracking-[0.12em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim hover:text-ak-text cursor-pointer"
          >
            Sign out
          </button>
        </div>
      )}
    </aside>
  );
}

function SidebarLink({
  link, currentPath, dashboardHref,
}: {
  link: NavLink; currentPath: string; dashboardHref: string;
}) {
  const active = isActiveLink(currentPath, link.href, dashboardHref);
  return (
    <Link
      href={link.href}
      aria-current={active ? "page" : undefined}
      className={[
        "px-3 py-[8px] text-[11px] font-black tracking-[0.12em] uppercase rounded-md transition-colors duration-150 border-l-2",
        active
          ? "text-ak-red-text border-ak-red-bright bg-ak-base/60"
          : "text-ak-text-dim border-transparent hover:text-ak-text",
      ].join(" ")}
    >
      {link.label}
    </Link>
  );
}
