import { Hono } from "hono";
import { z } from "zod";
import { isPrefKey, PREFS, resolvePrefs } from "@skills/core";
import type { AppEnv } from "../../app.js";
import { invalid } from "./shared.js";

export const router = new Hono<AppEnv>();

const bodySchema = z.object({ key: z.string().min(1), value: z.unknown() });

router.get("/api/game/:skillId/prefs", (c) => {
  const rows = c
    .get("database")
    .raw.prepare("SELECT key, value_json FROM game_prefs WHERE skill_id = ?")
    .all(c.req.param("skillId")) as { key: string; value_json: string }[];
  const stored: Record<string, unknown> = {};
  for (const r of rows) {
    try {
      stored[r.key] = JSON.parse(r.value_json);
    } catch {
      // A damaged row falls back to the default.
    }
  }
  return c.json({ prefs: resolvePrefs(stored) });
});

router.put("/api/game/:skillId/prefs", async (c) => {
  const parsed = bodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const { key, value } = parsed.data;
  if (!isPrefKey(key)) {
    return c.json({ error: { code: "unknown_pref", message: `Unbekannte Einstellung: ${key}` } }, 400);
  }
  const checked = PREFS[key].schema.safeParse(value);
  if (!checked.success) {
    return c.json(
      { error: { code: "invalid_pref", message: checked.error.issues.map((i) => i.message).join("; ") } },
      400,
    );
  }
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_prefs (skill_id, key, value_json) VALUES (?, ?, ?)
       ON CONFLICT(skill_id, key) DO UPDATE SET value_json = excluded.value_json`,
    )
    .run(c.req.param("skillId"), key, JSON.stringify(checked.data));
  return c.json({ ok: true });
});

router.delete("/api/game/:skillId/prefs", (c) => {
  c.get("database").raw.prepare("DELETE FROM game_prefs WHERE skill_id = ?").run(c.req.param("skillId"));
  return c.json({ ok: true });
});

router.delete("/api/game/:skillId/prefs/:key", (c) => {
  c.get("database")
    .raw.prepare("DELETE FROM game_prefs WHERE skill_id = ? AND key = ?")
    .run(c.req.param("skillId"), c.req.param("key"));
  return c.json({ ok: true });
});
