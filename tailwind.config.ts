import type { Config } from "tailwindcss"

const config: Config = {
  darkMode: ["class"],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./src/**/*.{ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        base: "#0A0A0B",
        surface: "#111113",
        elevated: "#1A1A1E",
        overlay: "#222226",
        border: "#27272A",
        "border-subtle": "#18181B",
        primary: "#8B5CF6",
        "primary-dark": "#6D28D9",
        "primary-soft": "#8B5CF620",
        foreground: "#FAFAFA",
        secondary: "#A1A1AA",
        muted: "#71717A"
      },
      fontFamily: {
        sans: [
          "Inter",
          "-apple-system",
          "BlinkMacSystemFont",
          "sans-serif"
        ],
        serif: [
          "Georgia",
          "\"Noto Serif SC\"",
          "serif"
        ]
      },
      borderRadius: {
        lg: "12px",
        md: "8px",
        sm: "6px"
      },
      boxShadow: {
        panel: "0 4px 16px rgba(0,0,0,0.30)"
      }
    }
  },
  plugins: []
}

export default config
