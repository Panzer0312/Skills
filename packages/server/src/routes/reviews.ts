import { buildQueue, previewAll, schedule, type QueueCard, type Rating, type SchedulingState } from "@skills/core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import type { AppDatabase } from "../db/client.js";

const reviewSchema = z.object({
  cardId: z.number().int().positive(),
  rating: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]),
  elapsedMs: z.number().int().nonnegative().default(0),
});

interface CardRow {
  id: number;
  skill_id: string;
  module_id: string;
  card_key: string;
  front_json: string;
  back_json: string;
  tags: string;
  state: string;
  due: number;
  stability: number;
  difficulty: number;
  reps: number;
  lapses: number;
  last_review: number | null;
}

function readSetting(database: AppDatabase, key: string, fallback: number): number {
  const row = database.raw.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  if (!row) return fallback;
  const parsed = Number(row.value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function startOfLocalDay(now: number): number {
  const d = new Date(now);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

function toSchedulingState(row: CardRow): SchedulingState {
  return {
    state: row.state as SchedulingState["state"],
    due: row.due,
    stability: row.stability,
    difficulty: row.difficulty,
    reps: row.reps,
    lapses: row.lapses,
    lastReview: row.last_review,
  };
}

export const reviewRoutes = new Hono<AppEnv>();

reviewRoutes.get("/api/queue", (c) => {
  const database = c.get("database");
  const now = Date.now();
  const skillId = c.req.query("skillId");
  const moduleId = c.req.query("moduleId");
  const limit = Number(c.req.query("limit") ?? "0");

  const conditions = ["c.state = 'active'", "s.suspended = 0", "(s.buried_until IS NULL OR s.buried_until <= ?)"];
  const params: unknown[] = [now];
  if (skillId) {
    conditions.push("c.skill_id = ?");
    params.push(skillId);
  }
  if (moduleId) {
    conditions.push("c.module_id = ?");
    params.push(moduleId);
  }

  const rows = database.raw
    .prepare(
      `SELECT c.id, c.skill_id, c.module_id, c.card_key, c.front_json, c.back_json, c.tags,
              s.state, s.due, s.stability, s.difficulty, s.reps, s.lapses, s.last_review
       FROM cards c JOIN scheduling s ON s.card_id = c.id
       WHERE ${conditions.join(" AND ")}`,
    )
    .all(...params) as CardRow[];

  const dayStart = startOfLocalDay(now);
  const doneToday = database.raw
    .prepare(
      `SELECT
         SUM(CASE WHEN state_before = 'new' THEN 1 ELSE 0 END) AS newDone,
         SUM(CASE WHEN state_before = 'review' THEN 1 ELSE 0 END) AS reviewDone
       FROM reviews WHERE reviewed_at >= ?`,
    )
    .get(dayStart) as { newDone: number | null; reviewDone: number | null };

  const queueInput: QueueCard[] = rows.map((row) => ({
    cardId: row.id,
    moduleId: row.module_id,
    scheduling: toSchedulingState(row),
  }));

  const queued = buildQueue(
    queueInput,
    {
      newPerDay: readSetting(database, "dailyNew", 20),
      reviewsPerDay: readSetting(database, "dailyReviews", 200),
      newDoneToday: doneToday.newDone ?? 0,
      reviewsDoneToday: doneToday.reviewDone ?? 0,
    },
    now,
  );

  const byId = new Map(rows.map((row) => [row.id, row]));
  const limited = limit > 0 ? queued.slice(0, limit) : queued;

  const cards = limited.map((entry) => {
    const row = byId.get(entry.cardId)!;
    const preview = previewAll(entry.scheduling, now);
    return {
      id: row.id,
      skillId: row.skill_id,
      moduleId: row.module_id,
      cardKey: row.card_key,
      front: JSON.parse(row.front_json),
      back: JSON.parse(row.back_json),
      tags: JSON.parse(row.tags),
      scheduling: entry.scheduling,
      preview: {
        1: { due: preview[1].due },
        2: { due: preview[2].due },
        3: { due: preview[3].due },
        4: { due: preview[4].due },
      },
    };
  });

  return c.json({ cards });
});

reviewRoutes.post("/api/reviews", async (c) => {
  const database = c.get("database");
  const body = await c.req.json().catch(() => null);
  const parsed = reviewSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_body", message: parsed.error.issues.map((i) => i.message).join("; ") } },
      400,
    );
  }

  const row = database.raw
    .prepare(
      `SELECT c.id, c.skill_id, c.module_id, c.card_key, c.front_json, c.back_json, c.tags,
              s.state, s.due, s.stability, s.difficulty, s.reps, s.lapses, s.last_review
       FROM cards c JOIN scheduling s ON s.card_id = c.id WHERE c.id = ?`,
    )
    .get(parsed.data.cardId) as CardRow | undefined;

  if (!row) {
    return c.json({ error: { code: "not_found", message: "Karte nicht gefunden." } }, 404);
  }

  const now = Date.now();
  const before = toSchedulingState(row);
  const after = schedule(before, parsed.data.rating as Rating, now);

  const write = database.raw.transaction(() => {
    database.raw
      .prepare(
        `UPDATE scheduling SET state = ?, due = ?, stability = ?, difficulty = ?,
                reps = ?, lapses = ?, last_review = ?, buried_until = NULL WHERE card_id = ?`,
      )
      .run(after.state, after.due, after.stability, after.difficulty, after.reps, after.lapses, after.lastReview, row.id);
    database.raw
      .prepare(
        `INSERT INTO reviews (card_id, reviewed_at, rating, elapsed_ms, state_before, state_after)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(row.id, now, parsed.data.rating, parsed.data.elapsedMs, before.state, after.state);
  });
  write();

  return c.json({ scheduling: after });
});

reviewRoutes.post("/api/cards/:id/suspend", async (c) => {
  const database = c.get("database");
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const suspended = z.object({ suspended: z.boolean() }).safeParse(body);
  if (!suspended.success) {
    return c.json({ error: { code: "invalid_body", message: "Feld 'suspended' fehlt." } }, 400);
  }
  database.raw
    .prepare("UPDATE scheduling SET suspended = ? WHERE card_id = ?")
    .run(suspended.data.suspended ? 1 : 0, id);
  return c.json({ ok: true });
});

reviewRoutes.post("/api/cards/:id/bury", async (c) => {
  const database = c.get("database");
  const id = Number(c.req.param("id"));
  const body = await c.req.json().catch(() => ({}));
  const parsed = z.object({ untilTs: z.number().int().positive() }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_body", message: "Feld 'untilTs' fehlt." } }, 400);
  }
  database.raw.prepare("UPDATE scheduling SET buried_until = ? WHERE card_id = ?").run(parsed.data.untilTs, id);
  return c.json({ ok: true });
});
