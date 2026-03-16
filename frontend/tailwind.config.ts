import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        base: "#080810",
        surface: "#0D0D1A",
        amber: "#D4A017",
        "amber-dim": "#8B6914",
        electric: "#4A9EFF",
        "electric-dim": "#2A5E9F",
        resolve: "#3DB87A",
        danger: "#FF6B6B",
        muted: "#4A4A5A",
        "text-primary": "#E8E8EC",
        "text-secondary": "#9A9AAA",
      },
      fontFamily: {
        serif: ["DM Serif Display", "Georgia", "serif"],
        mono: ["IBM Plex Mono", "Menlo", "monospace"],
        sans: ["DM Sans", "system-ui", "sans-serif"],
      },
      animation: {
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "slide-in": "slide-in 0.6s ease-out",
        "fade-up": "fade-up 0.8s ease-out",
        "ticker": "ticker 60s linear infinite",
      },
      keyframes: {
        "pulse-dot": {
          "0%, 100%": { opacity: "1", transform: "scale(1)" },
          "50%": { opacity: "0.4", transform: "scale(0.8)" },
        },
        "slide-in": {
          from: { opacity: "0", transform: "translateX(-40px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(30px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "ticker": {
          from: { transform: "translateX(0)" },
          to: { transform: "translateX(-50%)" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
