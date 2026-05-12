import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/server/security/edge/csp";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Always allow maintenance page itself
  const isMaintenancePage = pathname.startsWith("/maintenance");

  // Allow Next.js internal assets (required for the page to load)
  const isNextAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon.ico") ||
    pathname.startsWith("/public") ||
    pathname.startsWith("/robots.txt") ||
    pathname.startsWith("/sitemap.xml");

  // If not already on maintenance page or loading assets → redirect
  if (!isMaintenancePage && !isNextAsset) {
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Generate CSP nonce for allowed requests
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

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
