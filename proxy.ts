import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildCsp } from "@/server/security/edge/csp";
import { verifySession, SESSION_TTL_S } from "@/server/auth/session";

const ADMIN_SESSION_COOKIE = "__Host-ak_session";
const FLAG_TTL_MS = 10_000;

const STATIC_ASSET = /\.(?:png|jpe?g|gif|webp|svg|ico|css|js|map|woff2?|ttf|eot|otf|txt|xml|json|mp4|webm)$/i;

let cachedFlag: { value: boolean; ts: number } | null = null;

async function isMaintenanceOn(request: NextRequest): Promise<boolean> {
  if (cachedFlag && Date.now() - cachedFlag.ts < FLAG_TTL_MS) {
    return cachedFlag.value;
  }
  try {
    const url = new URL("/api/public/maintenance", request.url);
    // A protected preview answers this sub-request with a login redirect
    // unless the caller's bypass travels with it, which would leave the gate
    // permanently open there. The header is absent in production.
    const bypass = request.headers.get("x-vercel-protection-bypass");
    const res = await fetch(url, {
      cache: "no-store",
      headers: bypass ? { "x-vercel-protection-bypass": bypass } : undefined,
    });
    if (!res.ok) return false;
    const json = (await res.json()) as { enabled?: boolean };
    const value = json.enabled === true;
    cachedFlag = { value, ts: Date.now() };
    return value;
  } catch {
    return false; // fail-open: never lock the site out on a transient error
  }
}

// The same shape require-admin.ts enforces, minus the audit logging it needs
// to tell the rejection reasons apart.
function hasValidAdminSession(cookieValue: string | undefined): boolean {
  const payload = verifySession(cookieValue);
  if (!payload) return false;

  let parsed;
  try { parsed = JSON.parse(payload); } catch { return false; }

  if (!parsed?.ts || Date.now() - parsed.ts > SESSION_TTL_S * 1000) return false;
  return parsed.role === "admin";
}

function passThroughWithCsp(request: NextRequest) {
  const response = NextResponse.next();
  response.headers.set("Content-Security-Policy", buildCsp());
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isMaintenancePage = pathname.startsWith("/maintenance");
  const isAdminPath       = pathname.startsWith("/admin");
  const isNextAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml") ||
    STATIC_ASSET.test(pathname);

  if (isMaintenancePage || isAdminPath || isNextAsset) {
    return passThroughWithCsp(request);
  }

  if (!(await isMaintenanceOn(request))) {
    return passThroughWithCsp(request);
  }

  if (hasValidAdminSession(request.cookies.get(ADMIN_SESSION_COOKIE)?.value)) {
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
