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
 * A CSRF token the server will accept for this session cookie: the server binds
 * the two with an HMAC, so an unrelated random value no longer validates.
 */
export function makeCsrfToken(sessionValue) {
  const nonce   = randomBytes(32).toString("hex");
  const binding = createHmac("sha256", SESSION_SECRET).update(`${nonce}!${sessionValue}`).digest("base64url");
  return `${nonce}.${binding}`;
}

/**
 * Returns { cookies, csrfToken }. Inject cookies into the browser context
 * via context.addCookies(cookies), then pass csrfToken as x-csrf-token header
 * and origin: BASE_URL on every mutating request so csrfCheck passes.
 */
export function makeAdminAuth(username = "admin") {
  const host         = new URL(BASE_URL).hostname;
  const sessionValue = makeSessionCookieValue(username);
  const csrfToken    = makeCsrfToken(sessionValue);
  return {
    cookies: [
      {
        name:     "__Host-ak_session",
        value:    sessionValue,
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
