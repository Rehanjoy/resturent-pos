import type { Config } from "tailwindcss";

/**
 * Tailwind v4 is CSS-config-first (see `app/globals.css` `@theme` block for
 * the source of truth on tokens). This file is loaded via `@config` in
 * globals.css so editor tooling / plugins that still expect a JS config
 * (e.g. the Tailwind IntelliSense extension, third-party Tailwind plugins)
 * resolve the same brand tokens documented in docs/02-brand-kit.md.
 */
const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        accent: "var(--color-accent)",
        background: "var(--color-bg)",
        surface: "var(--color-surface)",
        text: "var(--color-text)",
        "text-muted": "var(--color-text-muted)",
        border: "var(--color-border)",
        success: "var(--color-success)",
        warning: "var(--color-warning)",
        error: "var(--color-error)",
        info: "var(--color-info)",
        sidebar: "var(--color-sidebar)",
        "sidebar-hover": "var(--color-sidebar-hover)",
        "sidebar-active": "var(--color-sidebar-active)",
        "sidebar-border": "var(--color-sidebar-border)",
        "sidebar-foreground": "var(--color-sidebar-foreground)",
        "sidebar-muted": "var(--color-sidebar-muted)",
      },
      fontSize: {
        h1: ["2rem", { lineHeight: "1.25" }],
        h2: ["1.5rem", { lineHeight: "1.3" }],
        h3: ["1.25rem", { lineHeight: "1.35" }],
        h4: ["1rem", { lineHeight: "1.4" }],
        body: ["0.9375rem", { lineHeight: "1.5" }],
        small: ["0.8125rem", { lineHeight: "1.4" }],
        button: ["1rem", { lineHeight: "1" }],
      },
      fontFamily: {
        heading: ["var(--font-poppins)", "Segoe UI", "sans-serif"],
        body: ["var(--font-inter)", "Segoe UI", "sans-serif"],
      },
    },
  },
};

export default config;
