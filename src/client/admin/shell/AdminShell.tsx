import Head from "next/head";
import { useRouter } from "next/router";
import { useEffect, useMemo, useState, type ReactElement, type ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { MobileDrawer } from "./MobileDrawer";
import { TopBar } from "./TopBar";
import { buildNav } from "./nav";
import { useAdminAuth } from "../use-admin-auth";
import { setUnauthorizedHandler } from "../csrf";
import { clearAdminData } from "../use-admin-data";
import { PasskeyLoginForm } from "../passkey-login-form";
import { AdminSessionContext, type Toast } from "../session";
import { afterPageLoad, afterRelogin } from "../session-sync";

export type AdminShellPageProps = { authed: boolean; showFallback: boolean; noPasskeys: boolean };

export function adminLayout(title: string) {
  return function getLayout(page: ReactElement<AdminShellPageProps>) {
    return <AdminShell title={title} pageProps={page.props}>{page}</AdminShell>;
  };
}

export function AdminShell({
  title,
  pageProps,
  children,
}: {
  title:     string;
  pageProps: AdminShellPageProps;
  children:  ReactNode;
}) {
  const router      = useRouter();
  const slug        = String(router.query.slug ?? "");
  const currentPath = router.asPath.split("?")[0].split("#")[0];
  const { authed, setAuthed, loginError, handleLogin, handlePasskeyLogin, handleLogout } = useAdminAuth(slug, pageProps.authed);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [toast,      setToast]      = useState<Toast | null>(null);
  const [expired,    setExpired]    = useState(false);
  const [reloadAfterLogin, setReloadAfterLogin] = useState(false);
  const [pageKey,    setPageKey]    = useState(0);

  useEffect(() => {
    setUnauthorizedHandler(() => setExpired(true));
    return () => setUnauthorizedHandler(null);
  }, []);

  // SSR re-checks the cookie on every navigation, so its answer overrides what this tab believed.
  const [seenPath, setSeenPath] = useState(router.asPath);
  if (seenPath !== router.asPath) {
    setSeenPath(router.asPath);
    const next = afterPageLoad({ authed, expired, reloadAfterLogin }, pageProps.authed);
    if (next.authed !== authed) setAuthed(next.authed);
    if (next.expired !== expired) setExpired(next.expired);
    if (next.reloadAfterLogin !== reloadAfterLogin) setReloadAfterLogin(next.reloadAfterLogin);
  }

  const session = useMemo(() => ({ slug, setToast }), [slug]);

  const logout = () => {
    clearAdminData();
    handleLogout();
  };
  const finishRelogin = () => {
    const { view, remount } = afterRelogin({ authed, expired, reloadAfterLogin });
    setExpired(view.expired);
    setReloadAfterLogin(view.reloadAfterLogin);
    if (!remount) return;
    setPageKey(k => k + 1);
    void router.replace(router.asPath, undefined, { scroll: false });
  };
  const reloginWithPasskey = async () => {
    const result = await handlePasskeyLogin();
    if (!result.failed) finishRelogin();
    return result;
  };
  const reloginWithPassword: typeof handleLogin = async (...args) => {
    const result = await handleLogin(...args);
    if (!result.failed) finishRelogin();
    return result;
  };

  if (!authed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-ak-base p-4">
        <Head>
          <meta name="robots" content="noindex, nofollow" />
        </Head>
        <PasskeyLoginForm
          onPasskeyLogin={handlePasskeyLogin}
          onFallbackLogin={handleLogin}
          loginError={loginError}
          showFallback={pageProps.showFallback}
          noPasskeys={pageProps.noPasskeys}
        />
      </div>
    );
  }

  const { dashboard, groups } = buildNav(slug);

  return (
    <AdminSessionContext.Provider value={session}>
      <div className="min-h-screen bg-ak-base">
        <Head>
          <meta name="robots" content="noindex, nofollow" />
        </Head>

        <Sidebar
          dashboard={dashboard}
          groups={groups}
          currentPath={currentPath}
          onLogout={logout}
        />
        <MobileDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          dashboard={dashboard}
          groups={groups}
          currentPath={currentPath}
          onLogout={logout}
        />

        <div className="lg:pl-[240px]">
          <TopBar title={title} onOpenMenu={() => setDrawerOpen(true)} />
          <main key={pageKey} className="max-w-[1100px] mx-auto py-8 px-4">{children}</main>
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

        {expired && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="session-expired-title"
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
          >
            <div className="flex flex-col items-center gap-3">
              <div id="session-expired-title" className="text-[13px] font-bold text-ak-text text-center">
                Your session expired. Sign in again to keep your changes.
              </div>
              <PasskeyLoginForm
                onPasskeyLogin={reloginWithPasskey}
                onFallbackLogin={reloginWithPassword}
                loginError={loginError}
                showFallback={pageProps.showFallback}
                noPasskeys={false}
              />
              <a href={router.asPath} className="text-[11px] font-bold text-ak-red-text">
                Reload and sign in
              </a>
            </div>
          </div>
        )}
      </div>
    </AdminSessionContext.Provider>
  );
}
