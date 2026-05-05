// This file configures the initialization of Sentry for edge features (middleware, edge routes, and so on).
// The config you add here will be used whenever one of the edge features is loaded.
// Note that this config is unrelated to the Vercel Edge Runtime and is also required when running locally.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const PII_PATTERNS = [
  [/token=[0-9a-f]+/gi,  "token=[redacted]"],
  [/admin\/[^?#\s]+/gi,  "admin/[redacted]"],
  [/coach\/[^?#\s]+/gi,  "coach/[redacted]"],
];

function scrubUrl(url) {
  return PII_PATTERNS.reduce(
    (u, [re, replacement]) => u.replace(re, replacement),
    url
  );
}

function scrubEvent(event) {
  if (event.request?.url) {
    event.request.url = scrubUrl(event.request.url);
  }
  if (event.request?.query_string) {
    event.request.query_string = "[redacted]";
  }
  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1,
  sendDefaultPii: false,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});
