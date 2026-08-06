import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";

export const settingsRoutes = new Hono<AppEnv>();

settingsRoutes.get("/api/settings", (c) => {
  const rows = c.get("database").raw.prepare("SELECT key, value FROM settings").all() as {
    key: string;
    value: string;
  }[];
  const settings: Record<string, string> = {};
  for (const row of rows) settings[row.key] = row.value;
  return c.json({ settings });
});

settingsRoutes.put("/api/settings", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.record(z.string()).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_body", message: "Erwartet wird ein Objekt aus Strings." } }, 400);
  }
  const { raw } = c.get("database");
  const upsert = raw.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  );
  const write = raw.transaction(() => {
    for (const [key, value] of Object.entries(parsed.data)) upsert.run(key, value);
  });
  write();
  return c.json({ ok: true });
});
