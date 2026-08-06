import { Hono } from "hono";
import { cors } from "hono/cors";
import type { AppDatabase } from "./db/client.js";
import { backupRoutes } from "./routes/backup.js";
import { progressRoutes } from "./routes/progress.js";
import { reviewRoutes } from "./routes/reviews.js";
import { settingsRoutes } from "./routes/settings.js";
import { skillsRoutes } from "./routes/skills.js";
import { statsRoutes } from "./routes/stats.js";

export interface AppEnv {
  Variables: { database: AppDatabase };
}

export function createApp(database: AppDatabase): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use("*", cors({ origin: ["http://localhost:5173"] }));
  app.use("*", async (c, next) => {
    c.set("database", database);
    await next();
  });

  app.get("/api/health", (c) => c.json({ ok: true }));

  app.route("/", skillsRoutes);
  app.route("/", reviewRoutes);
  app.route("/", settingsRoutes);
  app.route("/", progressRoutes);
  app.route("/", statsRoutes);
  app.route("/", backupRoutes);

  app.notFound((c) =>
    c.json({ error: { code: "not_found", message: "Route nicht gefunden." } }, 404),
  );

  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: { code: "internal", message: err.message } }, 500);
  });

  return app;
}
