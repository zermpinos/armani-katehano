import type { Config } from "tailwindcss";

// Color tokens kept in sync with src/theme/tokens.ts - one source of truth.
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
        md: "768px",
        lg: "1024px",
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
        "ak-blob-drift-1": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "33%":      { transform: "translate(44px,-32px) scale(1.08)" },
          "66%":      { transform: "translate(-24px,20px) scale(0.94)" },
        },
        "ak-blob-drift-2": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "40%":      { transform: "translate(-52px,28px) scale(1.06)" },
          "75%":      { transform: "translate(32px,-44px) scale(0.92)" },
        },
        "ak-blob-drift-3": {
          "0%, 100%": { transform: "translate(0,0) scale(1)" },
          "25%":      { transform: "translate(36px,48px) scale(1.04)" },
          "70%":      { transform: "translate(-38px,-18px) scale(1.09)" },
        },
        "ak-rotate-cw":  { to: { transform: "rotate(360deg)"  } },
        "ak-rotate-ccw": { to: { transform: "rotate(-360deg)" } },
        "ak-spotlight-pulse": {
          "0%, 100%": { opacity: "0.3"  },
          "50%":      { opacity: "0.58" },
        },
        "ak-sweep": {
          "0%":        { transform: "translateX(-50vw) skewX(-15deg)", opacity: "0" },
          "5%":        { opacity: "1" },
          "45%":       { opacity: "1" },
          "50%, 100%": { transform: "translateX(110vw) skewX(-15deg)", opacity: "0" },
        },
      },
      animation: {
        "fade-in":      "fadeIn 0.3s ease both",
        "slide-up":     "slideUp 0.4s ease both",
        "ak-spin":      "ak-spin 0.7s linear infinite",
        "ak-pulse":     "ak-pulse 2s ease-in-out infinite",
        "ak-blob-1":    "ak-blob-drift-1 18s ease-in-out infinite",
        "ak-blob-2":    "ak-blob-drift-2 24s ease-in-out infinite",
        "ak-blob-3":    "ak-blob-drift-3 14s ease-in-out infinite",
        "ak-rot-cw":    "ak-rotate-cw  12s linear infinite",
        "ak-rot-ccw":   "ak-rotate-ccw 20s linear infinite",
        "ak-spotlight": "ak-spotlight-pulse 5.5s ease-in-out infinite",
        "ak-sweep":     "ak-sweep 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};

export default config;
