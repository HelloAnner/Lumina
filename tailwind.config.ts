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
        "border-active": "var(--color-border-active)",
        primary: "var(--color-accent-blue)",
        "primary-dark": "#3D6BD9",
        "primary-soft": "rgba(108,142,239,0.08)",
        foreground: "var(--color-foreground)",
        secondary: "var(--color-secondary)",
        muted: "var(--color-muted)",
        placeholder: "var(--color-placeholder)",
        "prose-body": "var(--color-prose-body)",
        selected: "var(--color-selected)",
        "accent-blue": "var(--color-accent-blue)",
        "accent-warm": "var(--color-accent-warm)",
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
        "2xl": "22px",
        xl: "18px",
        lg: "14px",
        md: "10px",
        sm: "8px"
      },
      boxShadow: {
        panel: "0 2px 8px rgba(0,0,0,0.25), 0 8px 24px rgba(0,0,0,0.15)",
        "panel-light": "0 1px 2px rgba(0,0,0,0.02), 0 4px 12px rgba(0,0,0,0.012)"
      }
    }
  },
  plugins: []
}

export default config
