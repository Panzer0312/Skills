import Database from "better-sqlite3";
import { drizzle, type BetterSQLite3Database } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema.js";

export interface AppDatabase {
  db: BetterSQLite3Database<typeof schema>;
  raw: Database.Database;
  path: string;
  backupTo(target: string): Promise<void>;
  close(): void;
}

const DDL = `
CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  installed_at INTEGER NOT NULL,
  settings_json TEXT NOT NULL DEFAULT '{}'
);
CREATE TABLE IF NOT EXISTS modules (
  id TEXT NOT NULL,
  skill_id TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  meta_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (skill_id, id)
);
CREATE TABLE IF NOT EXISTS note_types (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  fields_json TEXT NOT NULL,
  templates_json TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL,
  note_type_id INTEGER,
  fields_json TEXT NOT NULL,
  source_apkg TEXT
);
CREATE TABLE IF NOT EXISTS cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  skill_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  card_key TEXT NOT NULL,
  note_id INTEGER,
  front_json TEXT NOT NULL,
  back_json TEXT NOT NULL,
  tags TEXT NOT NULL DEFAULT '[]',
  state TEXT NOT NULL DEFAULT 'active'
);
CREATE UNIQUE INDEX IF NOT EXISTS cards_identity ON cards (skill_id, module_id, card_key);
CREATE INDEX IF NOT EXISTS cards_by_module ON cards (skill_id, module_id);
CREATE TABLE IF NOT EXISTS scheduling (
  card_id INTEGER PRIMARY KEY,
  state TEXT NOT NULL,
  due INTEGER NOT NULL,
  stability REAL NOT NULL,
  difficulty REAL NOT NULL,
  reps INTEGER NOT NULL,
  lapses INTEGER NOT NULL,
  last_review INTEGER,
  suspended INTEGER NOT NULL DEFAULT 0,
  buried_until INTEGER
);
CREATE INDEX IF NOT EXISTS scheduling_by_due ON scheduling (due);
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id INTEGER NOT NULL,
  reviewed_at INTEGER NOT NULL,
  rating INTEGER NOT NULL,
  elapsed_ms INTEGER NOT NULL DEFAULT 0,
  state_before TEXT NOT NULL,
  state_after TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS reviews_by_time ON reviews (reviewed_at);
CREATE TABLE IF NOT EXISTS lesson_progress (
  skill_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL,
  status TEXT NOT NULL,
  completed_at INTEGER,
  checkpoint_json TEXT NOT NULL DEFAULT '{}',
  PRIMARY KEY (skill_id, lesson_id)
);
CREATE TABLE IF NOT EXISTS songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist TEXT,
  source_url TEXT,
  format TEXT NOT NULL,
  content TEXT NOT NULL,
  added_at INTEGER NOT NULL,
  difficulty INTEGER,
  tags TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS media (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  filename TEXT NOT NULL,
  mime TEXT NOT NULL,
  sha256 TEXT NOT NULL,
  path TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS media_by_sha ON media (sha256);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS chord_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  song_key TEXT NOT NULL DEFAULT '',
  symbol TEXT NOT NULL,
  name TEXT,
  frets_json TEXT NOT NULL,
  fingers_json TEXT NOT NULL,
  base_fret INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chord_overrides_identity
  ON chord_overrides (scope, song_key, symbol);
CREATE TABLE IF NOT EXISTS game_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, skill_id TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
  kind TEXT NOT NULL, quest_id TEXT, lesson_id TEXT, technique_id TEXT, seconds INTEGER NOT NULL,
  level INTEGER NOT NULL, rating TEXT, metric_key TEXT, metric_value REAL
);
CREATE INDEX IF NOT EXISTS game_log_by_skill ON game_log (skill_id, day);
CREATE TABLE IF NOT EXISTS game_levels (skill_id TEXT NOT NULL, technique_id TEXT NOT NULL, level INTEGER NOT NULL, PRIMARY KEY (skill_id, technique_id));
CREATE TABLE IF NOT EXISTS game_today (skill_id TEXT NOT NULL, day TEXT NOT NULL, minutes INTEGER NOT NULL, quest_ids_json TEXT NOT NULL, PRIMARY KEY (skill_id, day));
CREATE TABLE IF NOT EXISTS game_profile (skill_id TEXT PRIMARY KEY, placed_at INTEGER, target_song_id TEXT);
CREATE TABLE IF NOT EXISTS game_chosen (skill_id TEXT NOT NULL, lesson_id TEXT NOT NULL, chosen_at INTEGER NOT NULL, PRIMARY KEY (skill_id, lesson_id));
CREATE TABLE IF NOT EXISTS game_songs (skill_id TEXT NOT NULL, song_key TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, last_played INTEGER, tags_json TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (skill_id, song_key));
CREATE TABLE IF NOT EXISTS game_story_seen (skill_id TEXT NOT NULL, beat_id TEXT NOT NULL, seen_at INTEGER NOT NULL, PRIMARY KEY (skill_id, beat_id));
CREATE TABLE IF NOT EXISTS game_inventory (skill_id TEXT NOT NULL, item_id TEXT NOT NULL, price INTEGER NOT NULL, acquired_at INTEGER NOT NULL, PRIMARY KEY (skill_id, item_id));
CREATE TABLE IF NOT EXISTS game_equipped (skill_id TEXT NOT NULL, slot TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (skill_id, slot));
CREATE TABLE IF NOT EXISTS game_settings (skill_id TEXT PRIMARY KEY, sound INTEGER NOT NULL DEFAULT 0);
`;

export function openDatabase(path: string): AppDatabase {
  const raw = new Database(path);
  raw.pragma("journal_mode = WAL");

  const integrity = raw.pragma("integrity_check", { simple: true });
  if (integrity !== "ok") {
    throw new Error(
      `Datenbank beschädigt (${String(integrity)}). Bitte die jüngste Kopie aus data/backups/ wiederherstellen.`,
    );
  }

  raw.exec(DDL);
  return {
    raw,
    db: drizzle(raw, { schema }),
    path,
    backupTo: async (target: string) => {
      await raw.backup(target);
    },
    close: () => raw.close(),
  };
}
