import { Hono } from "hono";
import { MAX_CHOSEN, localDayKey } from "@skills/core";
import type { AppEnv } from "../../app.js";
import {
  chosenBodySchema,
  invalid,
  lessonBodySchema,
  levelBodySchema,
  placementSchema,
  RANK,
  setLesson,
  STATUS_READ,
  todaySchema,
} from "./shared.js";

export const router = new Hono<AppEnv>();

router.put("/api/game/:skillId/level/:techniqueId", async (c) => {
  const parsed = levelBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_levels (skill_id, technique_id, level) VALUES (?, ?, ?)
       ON CONFLICT(skill_id, technique_id) DO UPDATE SET level = excluded.level`,
    )
    .run(c.req.param("skillId"), c.req.param("techniqueId"), parsed.data.level);
  return c.json({ ok: true });
});

router.put("/api/game/:skillId/lesson/:lessonId", async (c) => {
  const parsed = lessonBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  setLesson(c.get("database").raw, c.req.param("skillId"), c.req.param("lessonId"), parsed.data.status);
  return c.json({ ok: true });
});

router.put("/api/game/:skillId/today", async (c) => {
  const parsed = todaySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_today (skill_id, day, minutes, quest_ids_json) VALUES (?, ?, ?, ?)
       ON CONFLICT(skill_id, day) DO UPDATE SET minutes = excluded.minutes, quest_ids_json = excluded.quest_ids_json`,
    )
    .run(c.req.param("skillId"), localDayKey(Date.now()), parsed.data.minutes, JSON.stringify(parsed.data.questIds));
  return c.json({ ok: true });
});

router.post("/api/game/:skillId/placement", async (c) => {
  const parsed = placementSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const { knownLessonIds, levels, targetSongId } = parsed.data;
  raw.transaction(() => {
    for (const lessonId of knownLessonIds) {
      const current = raw
        .prepare("SELECT status FROM lesson_progress WHERE skill_id = ? AND lesson_id = ?")
        .get(skillId, lessonId) as { status: string } | undefined;
      const status = current ? (STATUS_READ[current.status] ?? "offen") : "offen";
      if (RANK[status] < RANK.gelernt) setLesson(raw, skillId, lessonId, "gelernt");
    }
    for (const [techniqueId, level] of Object.entries(levels)) {
      raw
        .prepare(
          `INSERT INTO game_levels (skill_id, technique_id, level) VALUES (?, ?, ?)
           ON CONFLICT(skill_id, technique_id) DO UPDATE SET level = excluded.level`,
        )
        .run(skillId, techniqueId, level);
    }
    raw
      .prepare(
        `INSERT INTO game_profile (skill_id, placed_at, target_song_id) VALUES (?, ?, ?)
         ON CONFLICT(skill_id) DO UPDATE SET placed_at = excluded.placed_at, target_song_id = excluded.target_song_id`,
      )
      .run(skillId, Date.now(), targetSongId);
  })();
  return c.json({ ok: true });
});

router.put("/api/game/:skillId/chosen/:lessonId", async (c) => {
  const parsed = chosenBodySchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const lessonId = c.req.param("lessonId");
  const { replace, mainRoad } = parsed.data;
  const result = raw.transaction(() => {
    const rows = raw
      .prepare(
        `SELECT g.lesson_id AS id FROM game_chosen g
         LEFT JOIN lesson_progress p ON p.skill_id = g.skill_id AND p.lesson_id = g.lesson_id
         WHERE g.skill_id = ? AND COALESCE(p.status, 'offen') NOT IN ('gelernt','gemeistert','done')`,
      )
      .all(skillId) as { id: string }[];
    const active = rows.map((r) => r.id);
    const validReplace = replace !== undefined && replace !== lessonId && active.includes(replace);
    // The main-road lesson comes on top of the chosen ones and takes no slot.
    const sideRoads = active.filter((id) => id !== mainRoad);
    const newSideRoad = lessonId !== mainRoad && !active.includes(lessonId);
    if (newSideRoad && sideRoads.length >= MAX_CHOSEN && !validReplace) return "limit" as const;
    if (validReplace) {
      raw
        .prepare("DELETE FROM game_chosen WHERE skill_id = ? AND lesson_id = ?")
        .run(skillId, replace);
    }
    raw
      .prepare(
        "INSERT INTO game_chosen (skill_id, lesson_id, chosen_at) VALUES (?, ?, ?) ON CONFLICT(skill_id, lesson_id) DO NOTHING",
      )
      .run(skillId, lessonId, Date.now());
    const current = raw
      .prepare(
        "SELECT status FROM lesson_progress WHERE skill_id = ? AND lesson_id = ?",
      )
      .get(skillId, lessonId) as { status: string } | undefined;
    if (!current || (STATUS_READ[current.status] ?? "offen") === "offen")
      setLesson(raw, skillId, lessonId, "aktiv");
    return "ok" as const;
  })();
  if (result === "limit") {
    return c.json(
      {
        error: {
          code: "limit",
          message: `Höchstens ${MAX_CHOSEN} gewählte Lektionen gleichzeitig.`,
        },
      },
      409,
    );
  }
  return c.json({ ok: true });
});

router.delete("/api/game/:skillId/chosen/:lessonId", (c) => {
  c.get("database")
    .raw.prepare("DELETE FROM game_chosen WHERE skill_id = ? AND lesson_id = ?")
    .run(c.req.param("skillId"), c.req.param("lessonId"));
  return c.json({ ok: true });
});
