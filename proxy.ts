import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/server/security/edge/csp";

const LAUNCH = new Date("2026-05-03T00:00:00Z").getTime();
const STATIC_ASSET = /\.(?:png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|otf|eot)$/i;

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (
    Date.now() < LAUNCH &&
    pathname !== "/coming-soon" &&
    !STATIC_ASSET.test(pathname)
  ) {
    return NextResponse.rewrite(new URL("/coming-soon", request.url));
  }

  const nonce = generateNonce();
  const csp   = buildCsp(nonce);

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  matcher: [
    {
      source: "/((?!api/|_next/static|_next/image|monitoring|favicon\\.ico).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
