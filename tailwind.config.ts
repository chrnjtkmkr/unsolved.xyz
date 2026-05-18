import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          orange: "#e0532b",
          orangeHover: "#c33d17",
        },
        bg: {
          primary: "var(--color-background-primary)",
          secondary: "var(--color-background-secondary)",
          tertiary: "var(--color-background-tertiary)",
        },
        txt: {
          primary: "var(--color-text-primary)",
          secondary: "var(--color-text-secondary)",
          tertiary: "var(--color-text-tertiary)",
        },
        border: {
          primary: "var(--color-border-secondary)",
          secondary: "var(--color-border-secondary)",
          tertiary: "var(--color-border-tertiary)",
        }
      },
      borderRadius: {
        md: "var(--border-radius-md)",
      }
    },
  },
  plugins: [],
};
export default config;
