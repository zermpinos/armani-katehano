import { useEffect } from "react";
import Link from "next/link";
import type { NavLink, NavGroup } from "./nav";
import { isActiveLink } from "./nav";

type Props = {
  open:        boolean;
  onClose:     () => void;
  dashboard:   NavLink;
  groups:      NavGroup[];
  currentPath: string;
  onLogout?:   () => void;
};

export function MobileDrawer({
  open, onClose, dashboard, groups, currentPath, onLogout,
}: Props) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = originalOverflow;
    };
  }, [open, onClose]);

  return (
    <div
      className={[
        "fixed inset-0 z-50 lg:hidden",
        open ? "pointer-events-auto" : "pointer-events-none",
      ].join(" ")}
      aria-hidden={!open}
    >
      <div
        className={[
          "absolute inset-0 bg-black/60 transition-opacity duration-200",
          open ? "opacity-100" : "opacity-0",
        ].join(" ")}
        onClick={onClose}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
        className={[
          "absolute inset-y-0 left-0 w-[260px] max-w-[80vw] bg-ak-surface border-r border-ak-border",
          "flex flex-col transition-transform duration-200 ease-out",
          open ? "translate-x-0" : "-translate-x-full",
        ].join(" ")}
      >
        <div className="px-6 py-5 flex items-center justify-between border-b border-ak-border">
          <div className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase">AK Admin</div>
          <button
            onClick={onClose}
            aria-label="Close menu"
            className="text-ak-text-dim text-[20px] font-black leading-none px-2 py-1 cursor-pointer"
          >
            ×
          </button>
        </div>
        <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col">
          <DrawerLink
            link={dashboard}
            currentPath={currentPath}
            dashboardHref={dashboard.href}
            onNavigate={onClose}
          />
          {groups.map(group => (
            <div key={group.label} className="mt-5">
              <div className="px-3 mb-1 text-[9px] font-black tracking-[0.18em] uppercase text-ak-text-dim">
                {group.label}
              </div>
              <div className="flex flex-col">
                {group.links.map(link => (
                  <DrawerLink
                    key={link.href}
                    link={link}
                    currentPath={currentPath}
                    dashboardHref={dashboard.href}
                    onNavigate={onClose}
                  />
                ))}
              </div>
            </div>
          ))}
        </nav>
        {onLogout && (
          <div className="px-3 py-4 border-t border-ak-border">
            <button
              onClick={() => { onClose(); onLogout(); }}
              className="w-full px-3 py-[8px] text-[10px] font-black tracking-[0.12em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim cursor-pointer"
            >
              Sign out
            </button>
          </div>
        )}
      </aside>
    </div>
  );
}

function DrawerLink({
  link, currentPath, dashboardHref, onNavigate,
}: {
  link: NavLink; currentPath: string; dashboardHref: string; onNavigate: () => void;
}) {
  const active = isActiveLink(currentPath, link.href, dashboardHref);
  return (
    <Link
      href={link.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={[
        "px-3 py-[10px] text-[12px] font-black tracking-[0.12em] uppercase rounded-md transition-colors duration-150 border-l-2",
        active
          ? "text-ak-red-text border-ak-red-bright bg-ak-base/60"
          : "text-ak-text-dim border-transparent",
      ].join(" ")}
    >
      {link.label}
    </Link>
  );
}
