import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },

  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.armani-katehano.com" }],
        destination: "https://armani-katehano.com/:path*",
        permanent: true,
      },
      {
        source: "/coming-soon",
        destination: "/",
        permanent: true,
      },
    ];
  },

  async rewrites() {
    return [
      { source: "/humans.txt", destination: "/api/humans-txt" },
      { source: "/sitemap.xml", destination: "/api/sitemap.xml" },
    ];
  },

  // Empty turbopack config silences the Next 16 warning that fires when a
  // `webpack` callback is present without a paired `turbopack` config. The
  // actual polyfill stripping under Turbopack is done by the prebuild script
  // `scripts/strip-next-polyfills.mjs`.
  turbopack: {},

  // Strip Next.js's hardcoded `require("next/dist/build/polyfills/polyfill-module")`
  // from the client bundle. The module ships ~14 KiB of conditional polyfills
  // for browsers below the production browserslist target (Chrome >=96,
  // Firefox >=94, Safari >=15.4, Edge >=96) - every method is natively
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
    const cspFallback = [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "style-src-attr 'unsafe-inline'",
      "object-src 'none'",
      "img-src 'self' data: https://res.cloudinary.com",
      "connect-src 'self'",
      "frame-ancestors 'none'",
      "base-uri 'none'",
      "form-action 'self'",
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

export default nextConfig;
