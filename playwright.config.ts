import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  // All specs share one e2e database; the prefs specs reset it, so files must not run side by side.
  workers: 1,
  use: { baseURL: "http://localhost:5173" },
  webServer: {
    command: "npm run dev",
    url: "http://localhost:5173",
    reuseExistingServer: false,
    timeout: 60_000,
    env: { SKILLS_DB_PATH: "data/e2e.db" },
  },
});
