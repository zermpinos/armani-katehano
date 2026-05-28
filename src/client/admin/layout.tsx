import Head from "next/head";
import Link from "next/link";
import type { ReactNode } from "react";

type Toast = { type?: string; msg: string };

export function AdminLayout({
  slug,
  title,
  children,
  toast,
  setToast,
  onLogout,
}: {
  slug: string | string[] | boolean | undefined;
  title: string;
  children: ReactNode;
  toast: Toast | null;
  setToast: (t: Toast | null) => void;
  onLogout?: () => void;
}) {
  const tabs = [
    { href: `/admin/${slug}`,                      label: "Dashboard"   },
    { href: `/admin/${slug}/games`,                label: "Games"       },
    { href: `/admin/${slug}/roster`,               label: "Roster"      },
    { href: `/admin/${slug}/seasons`,              label: "Seasons"     },
    { href: `/admin/${slug}/schedule`,             label: "Schedule"    },
    { href: `/admin/${slug}/subscribers`,          label: "Subscribers" },
    { href: `/admin/${slug}/broadcast`,            label: "Broadcast"   },
    { href: `/admin/${slug}/opponent-aliases`,     label: "Aliases"     },
    { href: `/admin/${slug}/import`,               label: "Import"      },
    { href: `/admin/${slug}/passkeys`,             label: "Passkeys"    },
  ];

  const current = typeof window !== "undefined" ? window.location.pathname : "";

  return (
    <div className="min-h-screen bg-ak-base">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      {/* Top bar */}
      <div className="bg-ak-surface border-b border-ak-border sticky top-0 z-40">
        <div className="max-w-[1100px] mx-auto px-4 flex items-center overflow-x-auto">
          <div className="text-[13px] font-black text-ak-red tracking-[0.1em] uppercase py-[14px] pr-6 border-r border-ak-border mr-4 whitespace-nowrap shrink-0">
            AK Admin
          </div>
          {tabs.map((t) => {
            const active =
              current === t.href ||
              (t.href !== `/admin/${slug}` && current.startsWith(t.href));
            return (
              <Link
                key={t.href}
                href={t.href}
                className={[
                  "px-[14px] py-[14px] text-[11px] font-black tracking-[0.12em] uppercase whitespace-nowrap transition-colors duration-150 border-b-2",
                  active
                    ? "text-ak-red-text border-ak-red-bright"
                    : "text-ak-text-dim border-transparent",
                ].join(" ")}
              >
                {t.label}
              </Link>
            );
          })}
          {onLogout && (
            <button
              onClick={onLogout}
              className="ml-auto px-3 py-[6px] text-[10px] font-black tracking-[0.1em] uppercase bg-transparent border border-ak-border2 rounded-md text-ak-text-dim cursor-pointer whitespace-nowrap shrink-0"
            >
              Sign out
            </button>
          )}
        </div>
      </div>

      {/* Page content */}
      <div className="max-w-[1100px] mx-auto py-8 px-4">{children}</div>

      {/* Toast */}
      {toast && (
        <div
          className={[
            "fixed bottom-6 right-6 z-50 px-[18px] py-3 rounded-[10px]",
            "flex items-center gap-3 text-[13px] font-bold shadow-[0_4px_16px_rgba(0,0,0,0.25)]",
            toast.type === "error"
              ? "bg-[#8b1a1a22] text-ak-red-text border border-[#8b1a1a55]"
              : "bg-[#4caf7d22] text-ak-green border border-[#4caf7d55]",
          ].join(" ")}
        >
          <span>{toast.msg}</span>
          <button
            aria-label="Close"
            onClick={() => setToast(null)}
            className="bg-transparent border-0 cursor-pointer text-[18px] text-current font-black leading-none p-0"
          >
            ×
          </button>
        </div>
      )}
    </div>
  );
}
