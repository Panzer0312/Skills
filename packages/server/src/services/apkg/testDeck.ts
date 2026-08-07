import Database from "better-sqlite3";
import { zipSync } from "fflate";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export interface TestNote {
  fields: string[];
  tags?: string[];
}

export interface TestDeckOptions {
  deckName?: string;
  fieldNames?: string[];
  templates?: string[];
  notes: TestNote[];
  media?: Record<string, string>;
  legacySchema?: boolean;
  collectionName?: "collection.anki2" | "collection.anki21";
}

const OLD_SCHEMA = `
CREATE TABLE col (id INTEGER PRIMARY KEY, crt INTEGER, mod INTEGER, scm INTEGER,
  ver INTEGER, dty INTEGER, usn INTEGER, ls INTEGER, conf TEXT, models TEXT,
  decks TEXT, dconf TEXT, tags TEXT);
CREATE TABLE notes (id INTEGER PRIMARY KEY, guid TEXT, mid INTEGER, mod INTEGER,
  usn INTEGER, tags TEXT, flds TEXT, sfld TEXT, csum INTEGER, flags INTEGER, data TEXT);
CREATE TABLE cards (id INTEGER PRIMARY KEY, nid INTEGER, did INTEGER, ord INTEGER,
  mod INTEGER, usn INTEGER, type INTEGER, queue INTEGER, due INTEGER, ivl INTEGER,
  factor INTEGER, reps INTEGER, lapses INTEGER, left INTEGER, odue INTEGER,
  odid INTEGER, flags INTEGER, data TEXT);
CREATE TABLE revlog (id INTEGER PRIMARY KEY, cid INTEGER, usn INTEGER, ease INTEGER,
  ivl INTEGER, lastIvl INTEGER, factor INTEGER, time INTEGER, type INTEGER);
`;

const NEW_TABLES = `
CREATE TABLE notetypes (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB);
CREATE TABLE fields (ntid INTEGER, ord INTEGER, name TEXT, config BLOB, PRIMARY KEY (ntid, ord));
CREATE TABLE templates (ntid INTEGER, ord INTEGER, name TEXT, mtime_secs INTEGER, usn INTEGER, config BLOB, PRIMARY KEY (ntid, ord));
CREATE TABLE decks (id INTEGER PRIMARY KEY, name TEXT, mtime_secs INTEGER, usn INTEGER, common BLOB, kind BLOB);
`;

/** Builds a real .apkg byte stream so the parser is tested against the actual format. */
export function buildTestApkg(options: TestDeckOptions): Uint8Array {
  const deckName = options.deckName ?? "Testdeck";
  const fieldNames = options.fieldNames ?? ["Vorderseite", "Rückseite"];
  const templates = options.templates ?? ["Karte 1"];
  const legacy = options.legacySchema ?? true;
  const noteTypeId = 1_600_000_000_000;
  const deckId = 1_600_000_000_001;

  const dir = mkdtempSync(join(tmpdir(), "apkg-build-"));
  const dbPath = join(dir, "collection.db");
  const db = new Database(dbPath);

  db.exec(OLD_SCHEMA);
  if (!legacy) db.exec(NEW_TABLES);

  const models = legacy
    ? JSON.stringify({
        [String(noteTypeId)]: {
          id: noteTypeId,
          name: "Basis",
          flds: fieldNames.map((name, ord) => ({ name, ord })),
          tmpls: templates.map((name, ord) => ({ name, ord })),
        },
      })
    : "{}";

  const decks = legacy
    ? JSON.stringify({ [String(deckId)]: { id: deckId, name: deckName } })
    : "{}";

  db.prepare(
    "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (1, 0, 0, 0, ?, 0, 0, 0, '{}', ?, ?, '{}', '{}')",
  ).run(legacy ? 11 : 18, models, decks);

  if (!legacy) {
    db.prepare("INSERT INTO notetypes (id, name, mtime_secs, usn, config) VALUES (?, 'Basis', 0, 0, x'')").run(noteTypeId);
    fieldNames.forEach((name, ord) => {
      db.prepare("INSERT INTO fields (ntid, ord, name, config) VALUES (?, ?, ?, x'')").run(noteTypeId, ord, name);
    });
    templates.forEach((name, ord) => {
      db.prepare(
        "INSERT INTO templates (ntid, ord, name, mtime_secs, usn, config) VALUES (?, ?, ?, 0, 0, x'')",
      ).run(noteTypeId, ord, name);
    });
    db.prepare("INSERT INTO decks (id, name, mtime_secs, usn, common, kind) VALUES (?, ?, 0, 0, x'', x'')").run(
      deckId,
      deckName,
    );
  }

  const insertNote = db.prepare(
    "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, 0, 0, ?, ?, ?, 0, 0, '')",
  );
  const insertCard = db.prepare(
    `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
     VALUES (?, ?, ?, ?, 0, 0, 2, 2, 5, 10, 2500, 3, 1, 0, 0, 0, 0, '')`,
  );

  options.notes.forEach((note, i) => {
    const noteId = 1_700_000_000_000 + i;
    insertNote.run(
      noteId,
      `guid-${i}`,
      noteTypeId,
      ` ${(note.tags ?? []).join(" ")} `,
      note.fields.join(String.fromCharCode(0x1f)),
      note.fields[0] ?? "",
    );
    templates.forEach((_, ord) => {
      insertCard.run(noteId * 10 + ord, noteId, deckId, ord);
    });
  });

  db.close();

  const collectionName = options.collectionName ?? (legacy ? "collection.anki2" : "collection.anki21");
  const files: Record<string, Uint8Array> = {
    [collectionName]: new Uint8Array(readFileSync(dbPath)),
  };

  const mediaEntries = Object.entries(options.media ?? {});
  const mediaMap: Record<string, string> = {};
  mediaEntries.forEach(([filename, content], i) => {
    mediaMap[String(i)] = filename;
    files[String(i)] = new TextEncoder().encode(content);
  });
  files["media"] = new TextEncoder().encode(JSON.stringify(mediaMap));

  rmSync(dir, { recursive: true, force: true });
  return zipSync(files);
}
