import Database from "better-sqlite3";
import { zipSync } from "fflate";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AppDatabase } from "../../db/client.js";
import { ApkgError } from "./read.js";

const SCHEMA = `
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
CREATE TABLE graves (usn INTEGER, oid INTEGER, type INTEGER);
`;

const NOTE_TYPE_ID = 1_500_000_000_000;
const DECK_ID = 1_500_000_000_001;
/** Anki joins a note's fields with the unit separator U+001F. */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

interface CardRow {
  card_key: string;
  front_json: string;
  back_json: string;
  tags: string;
}

export function writeApkg(
  database: AppDatabase,
  skillId: string,
  moduleId: string,
  deckName: string,
): Uint8Array {
  const rows = database.raw
    .prepare(
      "SELECT card_key, front_json, back_json, tags FROM cards WHERE skill_id = ? AND module_id = ? AND state = 'active' ORDER BY id",
    )
    .all(skillId, moduleId) as CardRow[];

  if (rows.length === 0) {
    throw new ApkgError("Dieses Modul enthält keine Karten zum Exportieren.");
  }

  const dir = mkdtempSync(join(tmpdir(), "apkg-write-"));
  const dbPath = join(dir, "collection.anki2");

  try {
    const db = new Database(dbPath);
    db.exec(SCHEMA);

    const models = JSON.stringify({
      [String(NOTE_TYPE_ID)]: {
        id: NOTE_TYPE_ID,
        name: "Skills-Export",
        type: 0,
        flds: ["Vorderseite", "Rückseite", "Lesung", "Notiz"].map((name, ord) => ({ name, ord })),
        tmpls: [
          {
            name: "Karte 1",
            ord: 0,
            qfmt: "{{Vorderseite}}",
            afmt: "{{FrontSide}}<hr id=answer>{{Rückseite}}<br>{{Lesung}}<br>{{Notiz}}",
          },
        ],
      },
    });

    const decks = JSON.stringify({ [String(DECK_ID)]: { id: DECK_ID, name: deckName } });
    const now = Date.now();

    db.prepare(
      "INSERT INTO col (id, crt, mod, scm, ver, dty, usn, ls, conf, models, decks, dconf, tags) VALUES (1, ?, ?, ?, 11, 0, 0, 0, '{}', ?, ?, '{}', '{}')",
    ).run(Math.floor(now / 1000), now, now, models, decks);

    const insertNote = db.prepare(
      "INSERT INTO notes (id, guid, mid, mod, usn, tags, flds, sfld, csum, flags, data) VALUES (?, ?, ?, ?, -1, ?, ?, ?, 0, 0, '')",
    );
    const insertCard = db.prepare(
      `INSERT INTO cards (id, nid, did, ord, mod, usn, type, queue, due, ivl, factor, reps, lapses, left, odue, odid, flags, data)
       VALUES (?, ?, ?, 0, ?, -1, 0, 0, ?, 0, 2500, 0, 0, 0, 0, 0, 0, '')`,
    );

    rows.forEach((row, i) => {
      const front = JSON.parse(row.front_json) as { text: string };
      const back = JSON.parse(row.back_json) as { text: string; reading: string | null; note: string | null };
      const tags = (JSON.parse(row.tags) as string[]).join(" ");
      const noteId = now + i;
      const fields = [front.text, back.text, back.reading ?? "", back.note ?? ""].join(FIELD_SEPARATOR);

      insertNote.run(noteId, row.card_key, NOTE_TYPE_ID, now, tags ? ` ${tags} ` : "", fields, front.text);
      insertCard.run(noteId + 1_000_000, noteId, DECK_ID, now, i);
    });

    db.close();

    return zipSync({
      "collection.anki2": new Uint8Array(readFileSync(dbPath)),
      media: new TextEncoder().encode("{}"),
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
