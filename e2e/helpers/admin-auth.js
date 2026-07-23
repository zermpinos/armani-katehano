import { createHmac, randomBytes } from "node:crypto";

const SESSION_SECRET = process.env.SESSION_SECRET;
const BASE_URL       = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";

export function makeSessionCookieValue(username = "admin") {
  const payload = JSON.stringify({ ts: Date.now(), role: "admin", user: username });
  const data    = Buffer.from(payload).toString("base64url");
  const sig     = createHmac("sha256", SESSION_SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

/**
 * Returns { cookies, csrfToken }. Inject cookies into the browser context
 * via context.addCookies(cookies), then pass csrfToken as x-csrf-token header
 * and origin: BASE_URL on every mutating request so csrfCheck passes.
 */
export function makeAdminAuth(username = "admin") {
  const host      = new URL(BASE_URL).hostname;
  const csrfToken = randomBytes(32).toString("hex");
  return {
    cookies: [
      {
        name:     "__Host-ak_session",
        value:    makeSessionCookieValue(username),
        domain:   host,
        path:     "/",
        secure:   true,
        httpOnly: true,
        sameSite: "Strict",
        expires:  -1,
      },
      {
        name:     "__Host-ak_csrf",
        value:    csrfToken,
        domain:   host,
        path:     "/",
        secure:   true,
        httpOnly: false,
        sameSite: "Strict",
        expires:  -1,
      },
    ],
    csrfToken,
    authHeaders: { origin: BASE_URL, "x-csrf-token": csrfToken },
  };
}
