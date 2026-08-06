import mdx from "@mdx-js/rollup";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [{ enforce: "pre", ...mdx({ providerImportSource: "@mdx-js/react" }) }, react()],
  resolve: {
    alias: { "@skills-content": resolve(__dirname, "../../skills") },
  },
  server: {
    port: 5173,
    proxy: { "/api": "http://localhost:5174" },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
  },
});
