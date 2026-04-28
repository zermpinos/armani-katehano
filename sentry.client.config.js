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
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (event.request?.query_string) event.request.query_string = "[redacted]";
  return event;
}

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  beforeSend: scrubEvent,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
});
