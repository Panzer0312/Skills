import { Hono } from "hono";
import type { SongMeta } from "@skills/core";
import type { AppEnv } from "../../app.js";
import { invalid, SONG_KEY, songMetaSchema, storySeenSchema, targetSongSchema } from "./shared.js";

export const router = new Hono<AppEnv>();

router.put("/api/game/:skillId/target-song", async (c) => {
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

router.get("/api/game/:skillId/songs", (c) => {
  const rows = c
    .get("database")
    .raw.prepare("SELECT song_key, stars, last_played, tags_json FROM game_songs WHERE skill_id = ?")
    .all(c.req.param("skillId")) as { song_key: string; stars: number; last_played: number | null; tags_json: string }[];
  const songs: Record<string, SongMeta> = {};
  for (const r of rows) {
    songs[r.song_key] = { stars: r.stars, lastPlayedAt: r.last_played, tags: JSON.parse(r.tags_json) as string[] };
  }
  return c.json({ songs });
});

router.put("/api/game/:skillId/song/:songKey", async (c) => {
  const songKey = c.req.param("songKey");
  if (!SONG_KEY.test(songKey)) {
    return c.json({ error: { code: "invalid_body", message: "Ungültiger Song-Schlüssel." } }, 400);
  }
  const parsed = songMetaSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const { stars, tags, played } = parsed.data;
  c.get("database")
    .raw.prepare(
      `INSERT INTO game_songs (skill_id, song_key, stars, last_played, tags_json) VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(skill_id, song_key) DO UPDATE SET
         stars = COALESCE(?, stars),
         last_played = COALESCE(?, last_played),
         tags_json = COALESCE(?, tags_json)`,
    )
    .run(
      c.req.param("skillId"),
      songKey,
      stars ?? 0,
      played ? Date.now() : null,
      JSON.stringify(tags ?? []),
      stars ?? null,
      played ? Date.now() : null,
      tags ? JSON.stringify(tags) : null,
    );
  return c.json({ ok: true });
});

router.put("/api/game/:skillId/story/seen", async (c) => {
  const parsed = storySeenSchema.safeParse(await c.req.json().catch(() => null));
  if (!parsed.success) return invalid(c, parsed.error);
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const insert = raw.prepare(
    "INSERT OR IGNORE INTO game_story_seen (skill_id, beat_id, seen_at) VALUES (?, ?, ?)",
  );
  const now = Date.now();
  raw.transaction(() => {
    for (const beatId of parsed.data.beatIds) insert.run(skillId, beatId, now);
  })();
  return c.json({ ok: true });
});
