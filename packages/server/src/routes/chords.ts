import { chordFileEntrySchema } from "@skills/core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";

/**
 * A global override stores the empty string as its song key, not NULL: SQLite treats
 * NULLs in a unique index as distinct from each other, so NULL would leave global
 * entries effectively unconstrained.
 */
const GLOBAL_KEY = "";

const putSchema = chordFileEntrySchema
  .extend({
    scope: z.enum(["global", "song"]),
    songKey: z.string().optional(),
  })
  .refine((value) => (value.scope === "song" ? Boolean(value.songKey?.trim()) : true), {
    message: "Für einen songbezogenen Griff fehlt der Song.",
  })
  .refine((value) => (value.scope === "global" ? !value.songKey : true), {
    message: "Ein globaler Griff darf keinen Song tragen.",
  });

interface Row {
  id: number;
  scope: string;
  songKey: string;
  symbol: string;
  name: string | null;
  fretsJson: string;
  fingersJson: string;
  baseFret: number;
  updatedAt: number;
}

function toEntry(row: Row) {
  return {
    id: row.id,
    scope: row.scope as "global" | "song",
    songKey: row.songKey,
    symbol: row.symbol,
    name: row.name,
    frets: JSON.parse(row.fretsJson) as (number | null)[],
    fingers: JSON.parse(row.fingersJson) as (number | null)[],
    baseFret: row.baseFret,
    updatedAt: row.updatedAt,
  };
}

const SELECT = `SELECT id, scope, song_key AS songKey, symbol, name,
  frets_json AS fretsJson, fingers_json AS fingersJson,
  base_fret AS baseFret, updated_at AS updatedAt FROM chord_overrides`;

export const chordRoutes = new Hono<AppEnv>();

chordRoutes.get("/api/chords", (c) => {
  const { raw } = c.get("database");

  if (c.req.query("all") === "1") {
    const rows = raw.prepare(`${SELECT} ORDER BY symbol`).all() as Row[];
    return c.json({ entries: rows.map(toEntry) });
  }

  const songKey = c.req.query("songKey")?.trim();
  const global = raw
    .prepare(`${SELECT} WHERE scope = 'global' ORDER BY symbol`)
    .all() as Row[];
  const song = songKey
    ? (raw.prepare(`${SELECT} WHERE scope = 'song' AND song_key = ? ORDER BY symbol`).all(songKey) as Row[])
    : [];

  return c.json({ global: global.map(toEntry), song: song.map(toEntry) });
});

chordRoutes.put("/api/chords", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Das Griffbild ist ungültig.",
        },
      },
      400,
    );
  }

  const { scope, songKey, symbol, name, frets, fingers, baseFret } = parsed.data;
  const key = scope === "song" ? songKey!.trim() : GLOBAL_KEY;
  const now = Date.now();

  c.get("database")
    .raw.prepare(
      `INSERT INTO chord_overrides (scope, song_key, symbol, name, frets_json, fingers_json, base_fret, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope, song_key, symbol) DO UPDATE SET
         name = excluded.name,
         frets_json = excluded.frets_json,
         fingers_json = excluded.fingers_json,
         base_fret = excluded.base_fret,
         updated_at = excluded.updated_at`,
    )
    .run(scope, key, symbol, name ?? null, JSON.stringify(frets), JSON.stringify(fingers), baseFret, now);

  const row = c
    .get("database")
    .raw.prepare(`${SELECT} WHERE scope = ? AND song_key = ? AND symbol = ?`)
    .get(scope, key, symbol) as Row;

  return c.json({ entry: toEntry(row) });
});

chordRoutes.delete("/api/chords", (c) => {
  const scope = c.req.query("scope");
  const symbol = c.req.query("symbol");
  if ((scope !== "global" && scope !== "song") || !symbol) {
    return c.json(
      { error: { code: "invalid_query", message: "Es fehlt der Geltungsbereich oder das Symbol." } },
      400,
    );
  }
  const key = scope === "song" ? (c.req.query("songKey") ?? "") : GLOBAL_KEY;

  c.get("database")
    .raw.prepare("DELETE FROM chord_overrides WHERE scope = ? AND song_key = ? AND symbol = ?")
    .run(scope, key, symbol);

  return c.json({ ok: true });
});
