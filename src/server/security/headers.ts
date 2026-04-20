export function securityHeaders() {
  return {
    "Content-Security-Policy":   "default-src 'none'; frame-ancestors 'none'",
    "X-Content-Type-Options":    "nosniff",
    "X-Frame-Options":           "DENY",
    "Referrer-Policy":           "no-referrer",
    "Permissions-Policy":        "camera=(), microphone=(), geolocation=()",
    "Cache-Control":             "no-store",
  };
}
