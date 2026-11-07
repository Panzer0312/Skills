import { Hono } from "hono";
import {
  goldForEntry,
  isMastered,
  localDayKey,
  suggestLevel,
  xpForEntry,
  type LessonStatus,
  type PracticeRating,
  type RecentLogEntry,
} from "@skills/core";
import type { AppEnv } from "../../app.js";
import { invalid, logSchema, RANK, setLesson, STATUS_READ } from "./shared.js";

export const router = new Hono<AppEnv>();

router.post("/api/game/:skillId/log", async (c) => {
  const parsed = logSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const body = parsed.data;
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const now = Date.now();
  const day = localDayKey(now);

  const run = raw.transaction(() => {
    const previousMax =
      body.metricKey !== undefined && body.metricValue !== undefined
        ? (raw
            .prepare("SELECT MAX(metric_value) AS m FROM game_log WHERE skill_id = ? AND metric_key = ?")
            .get(skillId, body.metricKey) as { m: number | null }).m
        : null;
    const isRecord =
      body.metricValue !== undefined && body.metricKey !== undefined && // A first value of 0 (nothing hit) is no record worth celebrating.
      (previousMax === null ? body.metricValue > 0 : body.metricValue > previousMax);

    const inserted = raw
      .prepare(
        `INSERT INTO game_log (skill_id, day, at, kind, quest_id, lesson_id, technique_id, seconds, level, rating, metric_key, metric_value)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        skillId,
        day,
        now,
        body.kind,
        body.questId ?? null,
        body.lessonId ?? null,
        body.techniqueId ?? null,
        body.seconds,
        body.level,
        body.rating ?? null,
        body.metricKey ?? null,
        body.metricValue ?? null,
      );

    let suggestion: number | null = null;
    if (body.techniqueId !== undefined) {
      const rated = raw
        .prepare(
          "SELECT rating, level FROM game_log WHERE skill_id = ? AND technique_id = ? AND rating IS NOT NULL ORDER BY at DESC, id DESC",
        )
        .all(skillId, body.techniqueId) as { rating: PracticeRating; level: number }[];
      suggestion = suggestLevel(rated, body.level);
    }

    if (body.lessonId !== undefined) {
      const current = raw
        .prepare("SELECT status FROM lesson_progress WHERE skill_id = ? AND lesson_id = ?")
        .get(skillId, body.lessonId) as { status: string } | undefined;
      const status = current ? (STATUS_READ[current.status] ?? "offen") : "offen";
      const entries = (
        raw
          .prepare(
            "SELECT rating, day, metric_value AS metricValue FROM game_log WHERE skill_id = ? AND lesson_id = ?",
          )
          .all(skillId, body.lessonId) as {
          rating: PracticeRating | null;
          day: string;
          metricValue: number | null;
        }[]
      );
      let next: LessonStatus = status;
      if (status === "offen") next = "aktiv";
      if (body.quick && (body.rating === "passt" || body.rating === "zu-leicht") && RANK[next] < RANK.gelernt) {
        next = "gelernt";
      }
      if (isMastered(entries, body.masteryTarget)) next = "gemeistert";
      if (RANK[next] > RANK[status]) setLesson(raw, skillId, body.lessonId, next);
    }

    return { suggestion, isRecord, logId: Number(inserted.lastInsertRowid) };
  });
  const { suggestion, isRecord, logId } = run();

  const xpGained = xpForEntry({
    kind: body.kind,
    seconds: body.seconds,
    level: body.level,
    rating: body.rating ?? null,
  });
  const goldGained = goldForEntry({
    kind: body.kind,
    seconds: body.seconds,
    level: body.level,
    rating: body.rating ?? null,
  });
  return c.json({ xpGained, goldGained, suggestion, isRecord, logId });
});

router.get("/api/game/:skillId/log/recent", (c) => {
  const rows = c
    .get("database")
    .raw.prepare(
      `SELECT id, at, day, kind, quest_id AS questId, technique_id AS techniqueId, seconds,
              metric_key AS metricKey, metric_value AS metricValue
       FROM game_log WHERE skill_id = ? ORDER BY at DESC, id DESC LIMIT 20`,
    )
    .all(c.req.param("skillId")) as RecentLogEntry[];
  return c.json({ entries: rows });
});

// Lesson statuses the deleted entry already raised stay: a status never goes down.
router.delete("/api/game/:skillId/log/:id", (c) => {
  const id = Number(c.req.param("id"));
  const result = Number.isInteger(id)
    ? c.get("database").raw.prepare("DELETE FROM game_log WHERE id = ? AND skill_id = ?").run(id, c.req.param("skillId"))
    : { changes: 0 };
  if (result.changes === 0) {
    return c.json({ error: { code: "not_found", message: "Eintrag nicht gefunden." } }, 404);
  }
  return c.json({ ok: true });
});
