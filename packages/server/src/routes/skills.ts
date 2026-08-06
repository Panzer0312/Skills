import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { syncSkill } from "../services/seedSync.js";

const seedCardSchema = z.object({
  moduleId: z.string().min(1),
  cardKey: z.string().min(1),
  front: z.string().min(1),
  back: z.string().min(1),
  reading: z.string().optional(),
  note: z.string().optional(),
  example: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

const seedRequestSchema = z.object({
  skillId: z.string().min(1),
  name: z.string().min(1),
  modules: z.array(z.object({ id: z.string(), type: z.string(), title: z.string() })),
  cards: z.array(seedCardSchema),
});

export const skillsRoutes = new Hono<AppEnv>();

skillsRoutes.get("/api/skills", (c) => {
  const { raw } = c.get("database");
  const rows = raw
    .prepare(
      `SELECT s.id, s.installed_at AS installedAt,
              (SELECT COUNT(*) FROM cards WHERE skill_id = s.id AND state = 'active') AS cardCount
       FROM skills s ORDER BY s.id`,
    )
    .all();
  return c.json({ skills: rows });
});

skillsRoutes.post("/api/skills/sync", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = seedRequestSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_body",
          message: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      },
      400,
    );
  }
  const result = syncSkill(c.get("database"), parsed.data, Date.now());
  return c.json(result);
});
