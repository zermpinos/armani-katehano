import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { generateNonce, buildCsp } from "@/server/security/edge/csp";

const LAUNCH = new Date("2026-05-03T00:00:00Z").getTime();

export function proxy(request: NextRequest) {
  if (Date.now() < LAUNCH && request.nextUrl.pathname !== "/coming-soon") {
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
