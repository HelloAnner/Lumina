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
        sidebar: "var(--color-sidebar)",
        border: "var(--color-border)",
        "border-subtle": "var(--color-border-subtle)",
        "border-hover": "var(--color-border-hover)",
        primary: "#3B82F6",
        "primary-dark": "#2563EB",
        "primary-soft": "#3B82F620",
        foreground: "var(--color-foreground)",
        secondary: "var(--color-secondary)",
        muted: "var(--color-muted)",
        placeholder: "var(--color-placeholder)",
        "prose-body": "var(--color-prose-body)",
        selected: "var(--color-selected)",
        "accent-blue": "var(--color-accent-blue)",
        "accent-purple": "var(--color-accent-purple)",
        "accent-magenta": "var(--color-accent-magenta)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
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
        "2xl": "20px",
        xl: "16px",
        lg: "12px",
        md: "10px",
        sm: "8px"
      },
      boxShadow: {
        panel: "0 4px 16px rgba(0,0,0,0.30), 0 8px 32px rgba(0,0,0,0.20)",
        "panel-light": "0 1px 3px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.015)"
      }
    }
  },
  plugins: []
}

export default config
