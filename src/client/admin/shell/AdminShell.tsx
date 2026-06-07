import Head from "next/head";
import { useRouter } from "next/router";
import { useState, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";
import { TopBar } from "./TopBar";
import { buildNav } from "./nav";

type Toast = { type?: string; msg: string };

export function AdminShell({
  slug,
  title,
  children,
  toast,
  setToast,
  onLogout,
}: {
  slug:     string | string[] | boolean | undefined;
  title:    string;
  children: ReactNode;
  toast:    Toast | null;
  setToast: (t: Toast | null) => void;
  onLogout?: () => void;
}) {
  const router = useRouter();
  const currentPath = router.asPath.split("?")[0].split("#")[0];
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { dashboard, groups } = buildNav(slug);

  return (
    <div className="min-h-screen bg-ak-base">
      <Head>
        <meta name="robots" content="noindex, nofollow" />
      </Head>

      <Sidebar
        dashboard={dashboard}
        groups={groups}
        currentPath={currentPath}
        onLogout={onLogout}
      />
      <MobileDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        dashboard={dashboard}
        groups={groups}
        currentPath={currentPath}
        onLogout={onLogout}
      />

      <div className="lg:pl-[240px]">
        <TopBar title={title} onOpenMenu={() => setDrawerOpen(true)} />
        <main className="max-w-[1100px] mx-auto py-8 px-4">{children}</main>
      </div>

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
