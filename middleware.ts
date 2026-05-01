import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const LAUNCH = new Date("2026-05-03T00:00:00Z").getTime();

export function middleware(request: NextRequest) {
  if (Date.now() >= LAUNCH) return NextResponse.next();
  if (request.nextUrl.pathname === "/coming-soon") return NextResponse.next();
  return NextResponse.rewrite(new URL("/coming-soon", request.url));
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|api/|.*\\.(?:png|ico|svg|txt|xml|html|webmanifest)$).*)",
  ],
};
