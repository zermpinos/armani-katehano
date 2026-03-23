// eslint.config.mjs
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = [
  ...nextCoreWebVitals,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
  {
    // Custom rules -- applied to all non-ignored JS/JSX files
    rules: {
      "no-undef": "error", // catches prodError, requireAuth, etc. used without import
    },
  },
];

export default eslintConfig;