import { Hono } from "hono";
import { z } from "zod";
import {
  computeStreak,
  isMastered,
  levelFromXp,
  MAX_CHOSEN,
  localDayKey,
  previousDay,
  suggestLevel,
  titleForLevel,
  weekStartKey,
  xpForEntry,
  type GameState,
  type LessonStatus,
  type PracticeRating,
} from "@skills/core";
import type { AppEnv } from "../app.js";

const levelSchema = z.number().int().min(1).max(10);
const statusSchema = z.enum(["offen", "aktiv", "gelernt", "gemeistert"]);

const logSchema = z.object({
  kind: z.enum(["quest", "frei"]),
  questId: z.string().min(1).optional(),
  lessonId: z.string().min(1).optional(),
  techniqueId: z.string().min(1).optional(),
  seconds: z.number().int().min(0).max(14400),
  level: levelSchema,
  rating: z.enum(["zu-leicht", "passt", "zu-schwer"]).optional(),
  metricKey: z.string().min(1).optional(),
  metricValue: z.number().finite().optional(),
  masteryTarget: z.number().finite().optional(),
  quick: z.boolean().optional(),
});
const levelBodySchema = z.object({ level: levelSchema });
const lessonBodySchema = z.object({ status: statusSchema });
const todaySchema = z.object({
  minutes: z.number().int().min(0).max(1440),
  questIds: z.array(z.string().min(1)),
});
const placementSchema = z.object({
  knownLessonIds: z.array(z.string().min(1)),
  levels: z.record(levelSchema),
  targetSongId: z.string().regex(/^(uebung|db):.+$/).nullable(),
});

const chosenBodySchema = z.object({ replace: z.string().min(1).optional() });
const targetSongSchema = z.object({ targetSongId: z.string().regex(/^(uebung|db):.+$/).nullable() });

const STATUS_READ: Record<string, LessonStatus> = {
  done: "gelernt",
  active: "aktiv",
  open: "offen",
  aktiv: "aktiv",
  gelernt: "gelernt",
  gemeistert: "gemeistert",
};
const RANK: Record<LessonStatus, number> = { offen: 0, aktiv: 1, gelernt: 2, gemeistert: 3 };

function invalid(c: { json: (b: unknown, s: 400) => Response }, error: z.ZodError) {
  return c.json(
    { error: { code: "invalid_body", message: error.issues.map((i) => i.message).join("; ") } },
    400,
  );
}

export const gameRoutes = new Hono<AppEnv>();

interface LogRow {
  day: string;
  kind: "quest" | "frei";
  quest_id: string | null;
  seconds: number;
  level: number;
  rating: PracticeRating | null;
  metric_key: string | null;
  metric_value: number | null;
}

gameRoutes.get("/api/game/:skillId/state", (c) => {
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const today = localDayKey(Date.now());
  const rows = raw
    .prepare(
      "SELECT day, kind, quest_id, seconds, level, rating, metric_key, metric_value FROM game_log WHERE skill_id = ?",
    )
    .all(skillId) as LogRow[];

  const xp = rows.reduce(
    (sum, r) => sum + xpForEntry({ kind: r.kind, seconds: r.seconds, level: r.level, rating: r.rating }),
    0,
  );
  const weekStart = weekStartKey(today);
  const yesterday = previousDay(today);
  const records: Record<string, number> = {};
  for (const r of rows) {
    if (r.metric_key !== null && r.metric_value !== null) {
      records[r.metric_key] = Math.max(records[r.metric_key] ?? -Infinity, r.metric_value);
    }
  }

  const levels: Record<string, number> = {};
  for (const r of raw
    .prepare("SELECT technique_id, level FROM game_levels WHERE skill_id = ?")
    .all(skillId) as { technique_id: string; level: number }[]) {
    levels[r.technique_id] = r.level;
  }
  const lessons: Record<string, LessonStatus> = {};
  for (const r of raw
    .prepare("SELECT lesson_id, status FROM lesson_progress WHERE skill_id = ?")
    .all(skillId) as { lesson_id: string; status: string }[]) {
    lessons[r.lesson_id] = STATUS_READ[r.status] ?? "offen";
  }
  const chosenLessons = (
    raw
      .prepare("SELECT lesson_id FROM game_chosen WHERE skill_id = ? ORDER BY chosen_at, rowid")
      .all(skillId) as { lesson_id: string }[]
  )
    .map((r) => r.lesson_id)
    .filter((id) => lessons[id] !== "gelernt" && lessons[id] !== "gemeistert");
  const profile = raw
    .prepare("SELECT placed_at, target_song_id FROM game_profile WHERE skill_id = ?")
    .get(skillId) as { placed_at: number | null; target_song_id: string | null } | undefined;
  const todayRow = raw
    .prepare("SELECT minutes, quest_ids_json FROM game_today WHERE skill_id = ? AND day = ?")
    .get(skillId, today) as { minutes: number; quest_ids_json: string } | undefined;

  const questIdsOn = (day: string) => [
    ...new Set(rows.filter((r) => r.day === day && r.quest_id !== null).map((r) => r.quest_id!)),
  ];
  const state: GameState = {
    placed: profile?.placed_at != null,
    targetSongId: profile?.target_song_id ?? null,
    xp,
    ...levelFromXp(xp),
    title: titleForLevel(levelFromXp(xp).level),
    streak: computeStreak([...new Set(rows.map((r) => r.day))], today),
    totalSeconds: rows.reduce((s, r) => s + r.seconds, 0),
    weekSeconds: rows.filter((r) => r.day >= weekStart).reduce((s, r) => s + r.seconds, 0),
    doneToday: questIdsOn(today),
    levels,
    lessons,
    chosenLessons,
    records,
    recentQuestIds: questIdsOn(yesterday),
    today: todayRow
      ? { minutes: todayRow.minutes, questIds: JSON.parse(todayRow.quest_ids_json) as string[] }
      : null,
  };
  return c.json(state);
});

gameRoutes.post("/api/game/:skillId/log", async (c) => {
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
    body.metricValue !== undefined && body.metricKey !== undefined && (previousMax === null || body.metricValue > previousMax);

  raw
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

  return { suggestion, isRecord };
  });
  const { suggestion, isRecord } = run();

  const xpGained = xpForEntry({
    kind: body.kind,
    seconds: body.seconds,
    level: body.level,
    rating: body.rating ?? null,
  });
  return c.json({ xpGained, suggestion, isRecord });
});

function setLesson(raw: import("better-sqlite3").Database, skillId: string, lessonId: string, status: LessonStatus) {
  raw
    .prepare(
      `INSERT INTO lesson_progress (skill_id, lesson_id, status, completed_at, checkpoint_json)
       VALUES (?, ?, ?, ?, '{}')
       ON CONFLICT(skill_id, lesson_id) DO UPDATE SET status = excluded.status,
         completed_at = CASE WHEN excluded.status IN ('gelernt','gemeistert') THEN COALESCE(completed_at, excluded.completed_at) ELSE completed_at END`,
    )
    .run(skillId, lessonId, status, status === "gelernt" || status === "gemeistert" ? Date.now() : null);
}

gameRoutes.put("/api/game/:skillId/level/:techniqueId", async (c) => {
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

gameRoutes.put("/api/game/:skillId/lesson/:lessonId", async (c) => {
  const parsed = lessonBodySchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  setLesson(c.get("database").raw, c.req.param("skillId"), c.req.param("lessonId"), parsed.data.status);
  return c.json({ ok: true });
});

gameRoutes.put("/api/game/:skillId/today", async (c) => {
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

gameRoutes.post("/api/game/:skillId/placement", async (c) => {
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

gameRoutes.put("/api/game/:skillId/chosen/:lessonId", async (c) => {
  const parsed = chosenBodySchema.safeParse(
    await c.req.json().catch(() => ({})),
  );
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const lessonId = c.req.param("lessonId");
  const { replace } = parsed.data;
  const result = raw.transaction(() => {
    const rows = raw
      .prepare(
        `SELECT g.lesson_id AS id FROM game_chosen g
         LEFT JOIN lesson_progress p ON p.skill_id = g.skill_id AND p.lesson_id = g.lesson_id
         WHERE g.skill_id = ? AND COALESCE(p.status, 'offen') NOT IN ('gelernt','gemeistert','done')`,
      )
      .all(skillId) as { id: string }[];
    const active = rows.map((r) => r.id);
    if (
      !active.includes(lessonId) &&
      active.length >= MAX_CHOSEN &&
      replace === undefined
    )
      return "limit" as const;
    if (replace !== undefined) {
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

gameRoutes.delete("/api/game/:skillId/chosen/:lessonId", (c) => {
  c.get("database")
    .raw.prepare("DELETE FROM game_chosen WHERE skill_id = ? AND lesson_id = ?")
    .run(c.req.param("skillId"), c.req.param("lessonId"));
  return c.json({ ok: true });
});

gameRoutes.put("/api/game/:skillId/target-song", async (c) => {
  const parsed = targetSongSchema.safeParse(
    await c.req.json().catch(() => null),
  );
  if (!parsed.success) return invalid(c, parsed.error);
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_profile (skill_id, placed_at, target_song_id) VALUES (?, NULL, ?)
       ON CONFLICT(skill_id) DO UPDATE SET target_song_id = excluded.target_song_id`,
    )
    .run(c.req.param("skillId"), parsed.data.targetSongId);
  return c.json({ ok: true });
});
