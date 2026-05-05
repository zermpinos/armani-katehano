import { withSentryConfig } from "@sentry/nextjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function sentryReportUri() {
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

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  // Strip Next.js's hardcoded `require("next/dist/build/polyfills/polyfill-module")`
  // from the client bundle. The module ships ~14 KiB of conditional polyfills
  // for browsers below the production browserslist target (Chrome >=96,
  // Firefox >=94, Safari >=15.4, Edge >=96) — every method is natively
  // supported there, so the bytes are dead code on every page load.
  //
  // Turbopack (Next 16's default build bundler) ignores resolveAlias for the
  // relative require originating inside node_modules, so the actual stripping
  // is done by scripts/strip-next-polyfills.mjs (wired into `npm run build`).
  // The webpack alias below covers webpack-only invocations.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        "next/dist/build/polyfills/polyfill-module": path.resolve(
          __dirname,
          "lib/empty-polyfill-module.js"
        ),
      };
    }
    return config;
  },

  async headers() {
    const reportUri = sentryReportUri();
    const cspFallback = [
      "default-src 'self'",
      "script-src 'self' https://*.sentry-cdn.com",
      "style-src 'self'",
      "object-src 'none'",
      "img-src 'self' data: https://res.cloudinary.com",
      "connect-src 'self' https://*.sentry.io",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
      ...(reportUri ? [`report-uri ${reportUri}`] : []),
    ].join("; ") + ";";

    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy",   value: cspFallback },
          { key: "X-Content-Type-Options",    value: "nosniff"    },
          { key: "X-Frame-Options",           value: "DENY"       },
          { key: "Referrer-Policy",           value: "no-referrer"},
          { key: "X-XSS-Protection",          value: "0"          },
          { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=()" },
          { key: "Strict-Transport-Security",    value: "max-age=63072000; includeSubDomains; preload" },
          { key: "Cross-Origin-Opener-Policy",  value: "same-origin" },
        ],
      },
      {
        source: "/admin/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store, no-cache, must-revalidate" },
          { key: "X-Robots-Tag",  value: "noindex, nofollow, noarchive"        },
        ],
      },
      {
        source: "/api/auth",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/admin/(.*)",
        headers: [
          { key: "Cache-Control", value: "no-store" },
        ],
      },
      {
        source: "/api/public/(.*)",
        headers: [
          { key: "Cache-Control", value: "public, s-maxage=60, stale-while-revalidate=300" },
        ],
      },
    ];
  },
};

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "pagkaki-corp",

  project: "armani-katehano",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  // Route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
