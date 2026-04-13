import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        bg: "#0a0a0f",
        surface: "#12121a",
        "surface-light": "#1a1a25",
        border: "rgba(196, 163, 90, 0.1)",
        "border-strong": "rgba(196, 163, 90, 0.2)",
        text: "#e8e4df",
        muted: "#6a6570",
        accent: "#c4a35a",
        "accent-hover": "#d4b36a",
        success: "#4ade80",
        danger: "#ef4444",
      },
      fontFamily: {
        sans: ["'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "monospace"],
        serif: ["'Cormorant Garamond'", "Georgia", "serif"],
      },
      width: {
        sidebar: "280px",
      },
    },
  },
  plugins: [],
};
export default config;
