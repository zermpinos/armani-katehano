// This file configures the initialization of Sentry on the server.
// The config you add here will be used whenever the server handles a request.
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";

const PII_PATTERNS = [
  /token=[0-9a-f]+/gi,
  /admin\/[^?#\s]+/gi,
  /coach\/[^?#\s]+/gi,
];

function scrubUrl(url) {
  return PII_PATTERNS.reduce(
    (u, re) => u.replace(re, (m) => m.split("=")[0] + "=[redacted]"),
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
  sendDefaultPii: false,
  tracesSampleRate: 0.1,
  beforeSend: scrubEvent,
  beforeSendTransaction: scrubEvent,
});

process.on("unhandledRejection", (reason) => {
  Sentry.captureException(reason);
});