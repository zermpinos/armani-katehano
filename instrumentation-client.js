// This file configures the initialization of Sentry on the client.
// In Next.js with @sentry/nextjs >= 9 this is the canonical client entry —
// it replaces the legacy sentry.client.config.js (defining both causes a
// double Sentry.init() and bundles BrowserTracing/Replay twice, bloating TBT).
// https://docs.sentry.io/platforms/javascript/guides/nextjs/

import * as Sentry from "@sentry/nextjs";
import {
  globalHandlersIntegration,
  inboundFiltersIntegration,
  dedupeIntegration,
} from "@sentry/nextjs";

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
  if (event.request?.url) event.request.url = scrubUrl(event.request.url);
  if (event.request?.query_string) event.request.query_string = "[redacted]";
  return event;
}

// Sentry's default integrations bundle BrowserTracing, Replay,
// BrowserSession, BrowserApiErrors, Breadcrumbs, HttpContext, etc. — tens
// of KiB of code that runs even when tracesSampleRate /
// replaysSessionSampleRate are 0. We only need uncaught-exception capture
// (globalHandlers), the noise filter that honors ignoreErrors above
// (inboundFilters), and dedupe to suppress duplicate reports.
Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  sendDefaultPii: false,
  tracesSampleRate: 0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,
  defaultIntegrations: false,
  integrations: [
    globalHandlersIntegration(),
    inboundFiltersIntegration(),
    dedupeIntegration(),
  ],
  beforeSend: scrubEvent,
  ignoreErrors: [
    "ResizeObserver loop limit exceeded",
    "ResizeObserver loop completed with undelivered notifications",
    "Non-Error promise rejection captured",
  ],
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
