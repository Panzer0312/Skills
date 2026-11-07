import { z } from "zod";
import { goldForEntry, ownedItems, type LessonStatus, type PracticeRating } from "@skills/core";

export const levelSchema = z.number().int().min(1).max(10);
export const statusSchema = z.enum(["offen", "aktiv", "gelernt", "gemeistert"]);

export const logSchema = z.object({
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
export const levelBodySchema = z.object({ level: levelSchema });
export const lessonBodySchema = z.object({ status: statusSchema });
export const todaySchema = z.object({
  minutes: z.number().int().min(0).max(1440),
  questIds: z.array(z.string().min(1)),
});
export const placementSchema = z.object({
  knownLessonIds: z.array(z.string().min(1)),
  levels: z.record(levelSchema),
  targetSongId: z.string().regex(/^(uebung|db):.+$/).nullable(),
});

export const chosenBodySchema = z.object({
  replace: z.string().min(1).optional(),
  mainRoad: z.string().min(1).optional(),
});
export const targetSongSchema = z.object({ targetSongId: z.string().regex(/^(uebung|db):.+$/).nullable() });

export const songMetaSchema = z.object({
  stars: z.number().int().min(0).max(5).optional(),
  tags: z.array(z.string().min(1).max(60)).max(40).optional(),
  played: z.literal(true).optional(),
});
export const storySeenSchema = z.object({ beatIds: z.array(z.string().min(1)).max(200) });
export const buyBodySchema = z.object({ itemId: z.string().min(1) });
export const equipBodySchema = z.object({
  slot: z.enum(["kopf", "waffe", "schild", "ring", "talisman"]),
  itemId: z.string().min(1).nullable(),
});
export const settingsSchema = z.object({ sound: z.boolean() });
export const SONG_KEY = /^(uebung|song):.+$/;

export const STATUS_READ: Record<string, LessonStatus> = {
  done: "gelernt",
  active: "aktiv",
  open: "offen",
  aktiv: "aktiv",
  gelernt: "gelernt",
  gemeistert: "gemeistert",
};
export const RANK: Record<LessonStatus, number> = { offen: 0, aktiv: 1, gelernt: 2, gemeistert: 3 };

export function invalid(c: { json: (b: unknown, s: 400) => Response }, error: z.ZodError) {
  return c.json(
    { error: { code: "invalid_body", message: error.issues.map((i) => i.message).join("; ") } },
    400,
  );
}
export interface LogRow {
  day: string;
  kind: "quest" | "frei";
  quest_id: string | null;
  seconds: number;
  level: number;
  rating: PracticeRating | null;
  metric_key: string | null;
  metric_value: number | null;
}

export function logRows(raw: import("better-sqlite3").Database, skillId: string) {
  return raw
    .prepare("SELECT kind, seconds, level, rating FROM game_log WHERE skill_id = ?")
    .all(skillId) as { kind: "quest" | "frei"; seconds: number; level: number; rating: PracticeRating | null }[];
}

/** Sum of gold forgiven after undoing an entry whose gold was already spent. */
export function goldAdjust(raw: import("better-sqlite3").Database, skillId: string): number {
  return (
    raw.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM game_gold_adjust WHERE skill_id = ?").get(skillId) as {
      s: number;
    }
  ).s;
}

/** Gold earned minus gold spent, plus the owned item ids. Call inside a transaction when acting on it. */
export function wallet(raw: import("better-sqlite3").Database, skillId: string) {
  const earned = logRows(raw, skillId).reduce((sum, r) => sum + goldForEntry(r), 0) + goldAdjust(raw, skillId);
  const bought = raw
    .prepare("SELECT item_id, price FROM game_inventory WHERE skill_id = ?")
    .all(skillId) as { item_id: string; price: number }[];
  const lessons: Record<string, LessonStatus> = {};
  for (const r of raw
    .prepare("SELECT lesson_id, status FROM lesson_progress WHERE skill_id = ?")
    .all(skillId) as { lesson_id: string; status: string }[]) {
    lessons[r.lesson_id] = STATUS_READ[r.status] ?? "offen";
  }
  return {
    gold: Math.max(0, earned - bought.reduce((sum, r) => sum + r.price, 0)),
    owned: ownedItems(
      bought.map((r) => r.item_id),
      lessons,
    ),
  };
}

export function setLesson(raw: import("better-sqlite3").Database, skillId: string, lessonId: string, status: LessonStatus) {
  raw
    .prepare(
      `INSERT INTO lesson_progress (skill_id, lesson_id, status, completed_at, checkpoint_json)
       VALUES (?, ?, ?, ?, '{}')
       ON CONFLICT(skill_id, lesson_id) DO UPDATE SET status = excluded.status,
         completed_at = CASE WHEN excluded.status IN ('gelernt','gemeistert') THEN COALESCE(completed_at, excluded.completed_at) ELSE completed_at END`,
    )
    .run(skillId, lessonId, status, status === "gelernt" || status === "gemeistert" ? Date.now() : null);
}
