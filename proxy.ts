import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/server/security/edge/csp";

const ADMIN_SESSION_COOKIE = "__Host-ak_session";
const FLAG_TTL_MS = 10_000;

// Files served from /public are reached at the root path (e.g. /logo.png,
// not /public/logo.png), so a `startsWith('/public')` check misses them.
// Match common static extensions so they pass through during maintenance -
// otherwise the maintenance page itself can't load its own logo/favicon.
const STATIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot|otf|txt|xml|json|mp4|webm)$/i;

let cachedFlag: { value: boolean; ts: number } | null = null;

async function isMaintenanceOn(request: NextRequest): Promise<boolean> {
  if (cachedFlag && Date.now() - cachedFlag.ts < FLAG_TTL_MS) {
    return cachedFlag.value;
  }
  try {
    const url = new URL("/api/public/maintenance", request.url);
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return false;
    const json = (await res.json()) as { enabled?: boolean };
    const value = json.enabled === true;
    cachedFlag = { value, ts: Date.now() };
    return value;
  } catch {
    return false; // fail-open: never lock the site out on a transient error
  }
}

function passThroughWithCsp(request: NextRequest) {
  const nonce = generateNonce();
  const csp = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Paths that must always load - needed for the maintenance page itself,
  // for the admin to log in and toggle the flag, and for Next's internals.
  const isMaintenancePage    = pathname.startsWith("/maintenance");
  const isAdminPath          = pathname.startsWith("/admin");
  const isMaintenanceFlagApi = pathname === "/api/public/maintenance";
  const isNextAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    STATIC_ASSET.test(pathname);

  if (isMaintenancePage || isAdminPath || isMaintenanceFlagApi || isNextAsset) {
    return passThroughWithCsp(request);
  }

  // Authenticated admins see the live site even while maintenance is on,
  // so they can verify changes before flipping the toggle off.
  const hasAdminSession = Boolean(request.cookies.get(ADMIN_SESSION_COOKIE)?.value);

  if (hasAdminSession || !(await isMaintenanceOn(request))) {
    return passThroughWithCsp(request);
  }

  const url = request.nextUrl.clone();
  url.pathname = "/maintenance";
  url.search = "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
