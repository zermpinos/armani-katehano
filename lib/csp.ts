export function generateNonce(): string {
  return Buffer.from(globalThis.crypto.randomUUID()).toString("base64");
}

function sentryReportUri(): string | null {
  const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!dsn) return null;
  try {
    const url = new URL(dsn);
    const project = url.pathname.replace(/^\//, "");
    return `https://${url.host}/api/${project}/security/?sentry_key=${url.username}`;
  } catch {
    return null;
  }
}

export function buildCsp(nonce: string): string {
  const reportUri = sentryReportUri();
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://*.sentry-cdn.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `connect-src 'self' https://*.sentry.io`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
    ...(reportUri ? [`report-uri ${reportUri}`] : []),
  ].join("; ");
}
