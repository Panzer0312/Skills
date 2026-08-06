import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";

const progressSchema = z.object({
  status: z.enum(["open", "active", "done"]),
  checkpoint: z.record(z.unknown()).default({}),
});

export const progressRoutes = new Hono<AppEnv>();

progressRoutes.get("/api/progress/:skillId", (c) => {
  const rows = c
    .get("database")
    .raw.prepare(
      "SELECT lesson_id AS lessonId, status, completed_at AS completedAt, checkpoint_json AS checkpointJson FROM lesson_progress WHERE skill_id = ?",
    )
    .all(c.req.param("skillId")) as {
    lessonId: string;
    status: string;
    completedAt: number | null;
    checkpointJson: string;
  }[];

  return c.json({
    lessons: rows.map((row) => ({
      lessonId: row.lessonId,
      status: row.status,
      completedAt: row.completedAt,
      checkpoint: JSON.parse(row.checkpointJson) as Record<string, unknown>,
    })),
  });
});

progressRoutes.put("/api/progress/:skillId/:lessonId", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = progressSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_body", message: parsed.error.issues.map((i) => i.message).join("; ") } },
      400,
    );
  }
  const completedAt = parsed.data.status === "done" ? Date.now() : null;
  c.get("database")
    .raw.prepare(
      `INSERT INTO lesson_progress (skill_id, lesson_id, status, completed_at, checkpoint_json)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(skill_id, lesson_id) DO UPDATE SET
         status = excluded.status,
         completed_at = excluded.completed_at,
         checkpoint_json = excluded.checkpoint_json`,
    )
    .run(
      c.req.param("skillId"),
      c.req.param("lessonId"),
      parsed.data.status,
      completedAt,
      JSON.stringify(parsed.data.checkpoint),
    );
  return c.json({ ok: true });
});
