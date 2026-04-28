import type { Config } from "tailwindcss";

// Color tokens kept in sync with src/theme/tokens.ts -- one source of truth.
const C = {
  base:       "#1c1c1e",
  surface:    "#242426",
  surface2:   "#2a2a2c",
  border:     "#333336",
  border2:    "#3d3d40",
  red:        "#8b1a1a",
  redBright:  "#c0392b",
  redText:    "#ec6666",
  text:       "#f0ede8",
  textSub:    "#a8a8ac",
  textDim:    "#919196",
  gold:       "#c9a84c",
  silver:     "#9ba3af",
  bronze:     "#b87333",
  green:      "#4caf7d",
  greenDim:   "#2d6b4a",
};

const config: Config = {
  content: [
    "./pages/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ak: {
          base:        C.base,
          surface:     C.surface,
          surface2:    C.surface2,
          border:      C.border,
          border2:     C.border2,
          red:         C.red,
          "red-bright": C.redBright,
          "red-text":   C.redText,
          text:        C.text,
          "text-sub":  C.textSub,
          "text-dim":  C.textDim,
          gold:        C.gold,
          silver:      C.silver,
          bronze:      C.bronze,
          green:       C.green,
          "green-dim": C.greenDim,
        },
      },
      fontFamily: {
        sans: ["'Trebuchet MS'", "'Gill Sans'", "system-ui", "sans-serif"],
      },
      screens: {
        sm: "640px",
      },
      keyframes: {
        fadeIn: {
          from: { opacity: "0", transform: "translateY(8px)" },
          to:   { opacity: "1", transform: "none" },
        },
        slideUp: {
          from: { opacity: "0", transform: "translateY(16px)" },
          to:   { opacity: "1", transform: "none" },
        },
        "ak-spin": {
          to: { transform: "rotate(360deg)" },
        },
        "ak-pulse": {
          "0%, 100%": { opacity: "1" },
          "50%":      { opacity: "0.4" },
        },
      },
      animation: {
        "fade-in":  "fadeIn 0.3s ease both",
        "slide-up": "slideUp 0.4s ease both",
        "ak-spin":  "ak-spin 0.7s linear infinite",
        "ak-pulse": "ak-pulse 2s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
