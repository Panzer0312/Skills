import type { Config } from "tailwindcss";

export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}", "../../skills/**/*.{ts,tsx,mdx}"],
  theme: { extend: {} },
} satisfies Config;
