import "@/server/_internal/node-only";
import crypto from "node:crypto";
import { SESSION_TTL_S } from "@/server/auth/session";

const CSRF_METHODS     = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const CSRF_COOKIE_NAME = "__Host-ak_csrf";

// The configured origin, never the request's own Host: both arrive in the same
// request, so comparing them asserts nothing. A preview deployment answers on a
// generated host and the e2e suite runs against one, so it allows its own.
function allowedHosts(): string[] {
  const hosts: string[] = [];
  const configured = process.env.NEXT_PUBLIC_APP_URL;
  if (configured) {
    try { hosts.push(new URL(configured).host); } catch { /* no host to allow */ }
  }
  if (process.env.VERCEL_ENV === "preview") {
    for (const host of [process.env.VERCEL_BRANCH_URL, process.env.VERCEL_URL]) {
      if (host) hosts.push(host);
    }
  }
  return hosts;
}

function originAllowed(value: string): boolean {
  try {
    const { host, hostname } = new URL(value);
    // `next dev` serves on localhost while the configured URL is the deployed
    // one, so without this no local mutation would pass.
    if (process.env.NODE_ENV === "development" && (hostname === "localhost" || hostname === "127.0.0.1")) {
      return true;
    }
    return allowedHosts().includes(host);
  } catch { return false; }
}

export function csrfCheck(req: any): boolean {
  if (!CSRF_METHODS.has(req.method)) return true;
  const origin  = req.headers["origin"];
  const referer = req.headers["referer"];
  if (origin)  return originAllowed(origin);
  if (referer) return originAllowed(referer);
  // A mutating request with no browser origin at all is refused rather than
  // trusted. Every call site asked for this; it is no longer optional.
  return false;
}

// Signed double-submit: the nonce is worthless without a binding that only the
// session it was minted for reproduces, so an attacker who can write the cookie
// still cannot produce one that validates.
function bindToken(nonce: string, sessionValue: string): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET is not set");
  return crypto.createHmac("sha256", secret).update(`${nonce}!${sessionValue}`).digest("base64url");
}

export function generateCsrfToken(sessionValue: string): string {
  const nonce = crypto.randomBytes(32).toString("hex");
  return `${nonce}.${bindToken(nonce, sessionValue)}`;
}

// Max-Age pairs it with the session cookie, which has one. Without it the
// browser drops this on close and keeps the session, so the admin returns
// authenticated but unable to pass the check below on any mutating request.
// The cookie is issued at login and never re-issued, so there is no recovery
// short of logging in again.
export function buildCsrfCookie(sessionValue: string): string {
  return [
    `${CSRF_COOKIE_NAME}=${generateCsrfToken(sessionValue)}`,
    "Secure",
    "SameSite=Strict",
    "Path=/",
    `Max-Age=${SESSION_TTL_S}`,
  ].join("; ");
}

export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

function equal(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return crypto.timingSafeEqual(x, y);
}

export function csrfTokenCheck(req: any, sessionValue: string): boolean {
  if (!CSRF_METHODS.has(req.method)) return true;
  // eslint-disable-next-line security/detect-object-injection
  const cookie = req.cookies?.[CSRF_COOKIE_NAME];
  const header = req.headers["x-csrf-token"];
  if (!cookie || !header || typeof header !== "string" || !sessionValue) return false;

  const dot = cookie.indexOf(".");
  if (dot <= 0) return false;

  try {
    return equal(cookie, header)
        && equal(cookie.slice(dot + 1), bindToken(cookie.slice(0, dot), sessionValue));
  } catch { return false; }
}
