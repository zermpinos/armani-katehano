// eslint.config.mjs
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import security from "eslint-plugin-security";
import noUnsanitized from "eslint-plugin-no-unsanitized";

const eslintConfig = [
  ...nextCoreWebVitals,
  security.configs.recommended,
  noUnsanitized.configs.recommended,
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