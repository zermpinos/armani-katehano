// Deprecated. Client init lives in instrumentation-client.js per
// @sentry/nextjs >= 9. Defining Sentry.init() here as well caused a
// double-init that bundled BrowserTracing/Replay twice and bloated TBT.
// Intentionally left empty so this file stays harmless if anything still
// references it.
