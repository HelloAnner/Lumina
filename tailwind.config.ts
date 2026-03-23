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
        base: "var(--color-base)",
        surface: "var(--color-surface)",
        elevated: "var(--color-elevated)",
        overlay: "var(--color-overlay)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        primary: "#8B5CF6",
        "primary-dark": "#6D28D9",
        "primary-soft": "#8B5CF620",
        foreground: "var(--color-foreground)",
        secondary: "var(--color-secondary)",
        muted: "var(--color-muted)",
        "reader-sidebar": "var(--color-reader-sidebar)",
        "reader-card": "var(--color-reader-card)",
        "reader-text": "var(--color-reader-text)"
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
