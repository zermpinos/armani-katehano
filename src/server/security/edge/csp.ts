export function generateNonce(): string {
  return Buffer.from(globalThis.crypto.randomUUID()).toString("base64");
}

export function buildCsp(nonce: string): string {
  const isPreview = process.env.VERCEL_ENV !== "production";
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}'${isPreview ? " https://vercel.live" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    `style-src-attr 'unsafe-inline'`,
    `object-src 'none'`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `connect-src 'self'${isPreview ? " https://vercel.live wss://ws-us3.pusher.com https://sockjs-us3.pusher.com" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
  ].join("; ");
}
