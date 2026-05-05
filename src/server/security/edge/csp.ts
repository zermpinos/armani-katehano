export function generateNonce(): string {
  return Buffer.from(globalThis.crypto.randomUUID()).toString("base64");
}

function sentryReportUri(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    const url     = new URL(dsn);
    const project = url.pathname.replace(/^\//, "");
    return `https://${url.host}/api/${project}/security/?sentry_key=${url.username}`;
  } catch { return null; }
}

export function buildCsp(nonce: string): string {
  const reportUri = sentryReportUri();
  const isPreview = process.env.VERCEL_ENV !== "production";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://*.sentry-cdn.com${isPreview ? " https://vercel.live" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `object-src 'none'`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `connect-src 'self' https://*.sentry.io${isPreview ? " https://vercel.live wss://ws-us3.pusher.com https://sockjs-us3.pusher.com" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ].join("; ");
}
