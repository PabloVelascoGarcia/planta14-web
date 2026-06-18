import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./lib/**/*.{js,ts,jsx,tsx,mdx}"
  ],
  theme: {
    extend: {
      colors: {
        coal: {
          50: "#f5f5f4",
          100: "#e7e5e4",
          800: "#292524",
          900: "#1c1917",
          950: "#0c0a09"
        },
        copper: "#a4522d",
        moss: "#53624a",
        steel: "#62717b",
        paper: "#f8f6f1"
      },
      fontFamily: {
        sans: ["var(--font-sans)", "Arial", "sans-serif"],
        serif: ["var(--font-serif)", "Georgia", "serif"]
      },
      boxShadow: {
        line: "inset 0 -1px 0 rgba(28, 25, 23, 0.12)"
      }
    }
  },
  plugins: []
};

export default config;
