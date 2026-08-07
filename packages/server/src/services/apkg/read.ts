import Database from "better-sqlite3";
import { unzipSync } from "fflate";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

export class ApkgError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApkgError";
  }
}

export interface ApkgNoteType {
  id: number;
  name: string;
  fields: string[];
  templates: { name: string; ord: number }[];
}

export interface ApkgNote {
  id: number;
  noteTypeId: number;
  fields: string[];
  tags: string[];
}

export interface ApkgCard {
  noteId: number;
  ord: number;
  type: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
}

export interface ApkgContent {
  deckName: string;
  noteTypes: ApkgNoteType[];
  notes: ApkgNote[];
  cards: ApkgCard[];
  media: Map<string, Uint8Array>;
}

/** Anki joins a note's fields with the unit separator U+001F. */
const FIELD_SEPARATOR = String.fromCharCode(0x1f);

function tableExists(db: Database.Database, name: string): boolean {
  const row = db.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?").get(name);
  return row !== undefined;
}

function readNoteTypes(db: Database.Database): ApkgNoteType[] {
  const col = db.prepare("SELECT models FROM col LIMIT 1").get() as { models: string } | undefined;

  if (col?.models && col.models !== "{}") {
    const parsed = JSON.parse(col.models) as Record<
      string,
      { id: number; name: string; flds: { name: string; ord: number }[]; tmpls: { name: string; ord: number }[] }
    >;
    return Object.values(parsed).map((model) => ({
      id: model.id,
      name: model.name,
      fields: [...model.flds].sort((a, b) => a.ord - b.ord).map((f) => f.name),
      templates: [...model.tmpls].sort((a, b) => a.ord - b.ord).map((t) => ({ name: t.name, ord: t.ord })),
    }));
  }

  if (!tableExists(db, "notetypes")) {
    throw new ApkgError("Die Sammlung enthält keine Notiztypen.");
  }

  const types = db.prepare("SELECT id, name FROM notetypes").all() as { id: number; name: string }[];
  return types.map((type) => ({
    id: type.id,
    name: type.name,
    fields: (
      db.prepare("SELECT name FROM fields WHERE ntid = ? ORDER BY ord").all(type.id) as { name: string }[]
    ).map((f) => f.name),
    templates: (
      db.prepare("SELECT name, ord FROM templates WHERE ntid = ? ORDER BY ord").all(type.id) as {
        name: string;
        ord: number;
      }[]
    ).map((t) => ({ name: t.name, ord: t.ord })),
  }));
}

function readDeckName(db: Database.Database): string {
  const col = db.prepare("SELECT decks FROM col LIMIT 1").get() as { decks: string } | undefined;
  if (col?.decks && col.decks !== "{}") {
    const parsed = JSON.parse(col.decks) as Record<string, { id: number; name: string }>;
    const named = Object.values(parsed).filter((deck) => deck.name !== "Default");
    if (named[0]) return named[0].name;
  }
  if (tableExists(db, "decks")) {
    const row = db.prepare("SELECT name FROM decks WHERE name != 'Default' ORDER BY id LIMIT 1").get() as
      | { name: string }
      | undefined;
    // Schema 18 stores nested deck names separated by U+001F rather than "::".
    if (row) return row.name.split(FIELD_SEPARATOR).join("::");
  }
  return "Importiertes Deck";
}

export function readApkg(bytes: Uint8Array): ApkgContent {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new ApkgError("Die Datei ist kein gültiges Zip-Archiv und damit keine .apkg-Datei.");
  }

  if (files["collection.anki21b"] && !files["collection.anki21"] && !files["collection.anki2"]) {
    throw new ApkgError(
      "Diese Datei nutzt das neue komprimierte Anki-Format. Exportiere sie in Anki noch einmal mit der Option „Unterstützung für ältere Anki-Versionen\".",
    );
  }

  const collection = files["collection.anki21"] ?? files["collection.anki2"];
  if (!collection) {
    throw new ApkgError("Das Archiv enthält keine Anki-Sammlung (collection.anki2 oder collection.anki21).");
  }

  const dir = mkdtempSync(join(tmpdir(), "apkg-read-"));
  const dbPath = join(dir, "collection.db");
  writeFileSync(dbPath, collection);

  try {
    const db = new Database(dbPath, { readonly: true });
    try {
      const noteTypes = readNoteTypes(db);
      const deckName = readDeckName(db);

      const notes = (
        db.prepare("SELECT id, mid, flds, tags FROM notes ORDER BY id").all() as {
          id: number;
          mid: number;
          flds: string;
          tags: string;
        }[]
      ).map((row) => ({
        id: row.id,
        noteTypeId: row.mid,
        fields: row.flds.split(FIELD_SEPARATOR),
        tags: row.tags.trim().split(/\s+/).filter(Boolean),
      }));

      const cards = (
        db
          .prepare("SELECT nid, ord, type, due, ivl, factor, reps, lapses FROM cards ORDER BY nid, ord")
          .all() as {
          nid: number;
          ord: number;
          type: number;
          due: number;
          ivl: number;
          factor: number;
          reps: number;
          lapses: number;
        }[]
      ).map((row) => ({
        noteId: row.nid,
        ord: row.ord,
        type: row.type,
        due: row.due,
        ivl: row.ivl,
        factor: row.factor,
        reps: row.reps,
        lapses: row.lapses,
      }));

      const media = new Map<string, Uint8Array>();
      const mediaIndex = files["media"];
      if (mediaIndex) {
        const mapping = JSON.parse(new TextDecoder().decode(mediaIndex)) as Record<string, string>;
        for (const [number, filename] of Object.entries(mapping)) {
          const payload = files[number];
          if (payload) media.set(filename, payload);
        }
      }

      return { deckName, noteTypes, notes, cards, media };
    } finally {
      db.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
