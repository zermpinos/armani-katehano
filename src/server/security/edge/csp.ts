import { scriptHashes, styleHashes } from "./csp-hashes";

export function buildCsp(): string {
  const isPreview = process.env.VERCEL_ENV !== "production";
  const fmt = (hs: readonly string[]) =>
    hs.length ? " " + hs.map(h => `'${h}'`).join(" ") : "";
  return [
    `default-src 'self'`,
    `script-src 'self'${fmt(scriptHashes)}${isPreview ? " https://vercel.live" : ""}`,
    `style-src 'self'${fmt(styleHashes)}`,
    `style-src-attr 'unsafe-inline'`,
    `object-src 'none'`,
    `img-src 'self' data: https://res.cloudinary.com`,
    `connect-src 'self'${isPreview ? " https://vercel.live wss://ws-us3.pusher.com https://sockjs-us3.pusher.com" : ""}`,
    `frame-src 'self'${isPreview ? " https://vercel.live" : ""}`,
    `frame-ancestors 'none'`,
    `base-uri 'none'`,
    `form-action 'self'`,
  ].join("; ");
}
