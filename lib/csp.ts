export function generateNonce(): string {
  return Buffer.from(globalThis.crypto.randomUUID()).toString("base64");
}

export function buildCsp(nonce: string): string {
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' https://*.sentry-cdn.com`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `connect-src 'self' https://*.sentry.io`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
  ].join("; ");
}
