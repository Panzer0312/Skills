import { detectFormat, parseSong } from "@skills/core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { assertPublicUrl, fetchSongFromUrl, FetchError } from "../services/songFetch.js";

const createSchema = z.object({
  content: z.string().min(1),
  title: z.string().optional(),
  artist: z.string().optional(),
  sourceUrl: z.string().optional(),
  difficulty: z.number().int().min(1).max(5).optional(),
  tags: z.array(z.string()).default([]),
});

export const songRoutes = new Hono<AppEnv>();

songRoutes.get("/api/songs", (c) => {
  const songs = c
    .get("database")
    .raw.prepare(
      "SELECT id, title, artist, source_url AS sourceUrl, format, content, added_at AS addedAt, difficulty, tags FROM songs ORDER BY added_at DESC",
    )
    .all();
  return c.json({ songs });
});

songRoutes.get("/api/songs/:id", (c) => {
  const song = c
    .get("database")
    .raw.prepare(
      "SELECT id, title, artist, source_url AS sourceUrl, format, content, added_at AS addedAt, difficulty, tags FROM songs WHERE id = ?",
    )
    .get(Number(c.req.param("id")));
  if (!song) return c.json({ error: { code: "not_found", message: "Song nicht gefunden." } }, 404);
  return c.json({ song });
});

songRoutes.post("/api/songs", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success || parsed.data.content.trim() === "") {
    return c.json(
      { error: { code: "invalid_body", message: "Der Songtext darf nicht leer sein." } },
      400,
    );
  }

  const song = parseSong(parsed.data.content);
  const format = detectFormat(parsed.data.content);
  const title = parsed.data.title?.trim() || song.title;
  const artist = parsed.data.artist?.trim() || song.artist;
  const now = Date.now();

  const info = c
    .get("database")
    .raw.prepare(
      `INSERT INTO songs (title, artist, source_url, format, content, added_at, difficulty, tags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      title,
      artist,
      parsed.data.sourceUrl ?? null,
      format,
      parsed.data.content,
      now,
      parsed.data.difficulty ?? null,
      JSON.stringify(parsed.data.tags),
    );

  return c.json({
    song: {
      id: Number(info.lastInsertRowid),
      title,
      artist,
      format,
      content: parsed.data.content,
      addedAt: now,
    },
  });
});

songRoutes.delete("/api/songs/:id", (c) => {
  c.get("database").raw.prepare("DELETE FROM songs WHERE id = ?").run(Number(c.req.param("id")));
  return c.json({ ok: true });
});

songRoutes.post("/api/songs/fetch", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = z.object({ url: z.string().min(1) }).safeParse(body);
  if (!parsed.success) {
    return c.json({ error: { code: "invalid_body", message: "Es fehlt eine URL." } }, 400);
  }

  try {
    assertPublicUrl(parsed.data.url);
    const result = await fetchSongFromUrl(parsed.data.url);
    return c.json(result);
  } catch (error) {
    if (error instanceof FetchError) {
      return c.json({ error: { code: error.code, message: error.message } }, 400);
    }
    throw error;
  }
});
