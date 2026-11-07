import { Hono } from "hono";
import { localDayKey } from "@skills/core";
import type { AppEnv } from "../../app.js";
import { invalid, settingsSchema } from "./shared.js";

export const router = new Hono<AppEnv>();

const EXPORT_TABLES = [
  "game_log",
  "game_levels",
  "game_today",
  "game_profile",
  "game_chosen",
  "game_songs",
  "game_story_seen",
  "game_inventory",
  "game_equipped",
  "game_settings",
  "lesson_progress",
] as const;

router.get("/api/game/:skillId/export", (c) => {
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const tables: Record<string, unknown[]> = {};
  for (const table of EXPORT_TABLES) {
    tables[table] = raw.prepare(`SELECT * FROM ${table} WHERE skill_id = ?`).all(skillId);
  }
  const now = Date.now();
  c.header("content-disposition", `attachment; filename="guitar-export-${localDayKey(now)}.json"`);
  return c.json({ exportedAt: now, skillId, tables });
});

router.put("/api/game/:skillId/settings", async (c) => {
  const parsed = settingsSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_settings (skill_id, sound) VALUES (?, ?)
       ON CONFLICT(skill_id) DO UPDATE SET sound = excluded.sound`,
    )
    .run(c.req.param("skillId"), parsed.data.sound ? 1 : 0);
  return c.json({ ok: true });
});
