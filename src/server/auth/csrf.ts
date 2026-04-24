import crypto from "crypto";

const CSRF_METHODS     = new Set(["POST", "PUT", "DELETE", "PATCH"]);
const CSRF_COOKIE_NAME = "__Host-ak_csrf";

export function csrfCheck(req: any, { strict = false } = {}) {
  if (!CSRF_METHODS.has(req.method)) return true;
  const host    = req.headers["host"]    ?? "";
  const origin  = req.headers["origin"]  ?? "";
  const referer = req.headers["referer"] ?? "";
  if (origin)  { try { return new URL(origin).host  === host; } catch { return false; } }
  if (referer) { try { return new URL(referer).host === host; } catch { return false; } }
  return !strict;
}

export function generateCsrfToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function buildCsrfCookie(token: string): string {
  return [`${CSRF_COOKIE_NAME}=${token}`, "Secure", "SameSite=Strict", "Path=/"].join("; ");
}

export function clearCsrfCookie(): string {
  return `${CSRF_COOKIE_NAME}=; Secure; SameSite=Strict; Path=/; Max-Age=0`;
}

export function csrfTokenCheck(req: any): boolean {
  if (!CSRF_METHODS.has(req.method)) return true;
  // eslint-disable-next-line security/detect-object-injection
  const cookie = req.cookies?.[CSRF_COOKIE_NAME];
  if (!cookie) return true;
  const header = req.headers["x-csrf-token"];
  if (!header || typeof header !== "string") return false;
  try {
    const a = Buffer.from(cookie, "utf8");
    const b = Buffer.from(header, "utf8");
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch { return false; }
}
