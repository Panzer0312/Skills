import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../../db/client.js";
import { importApkg } from "./importDeck.js";
import type { ApkgContent } from "./read.js";

describe("importApkg", () => {
  let dir: string;
  let database: AppDatabase;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "import-deck-"));
    database = openDatabase(join(dir, "app.db"));
  });

  afterEach(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const noteTypeId = 1;

  function contentWith(mediaFilename: string): ApkgContent {
    return {
      deckName: "Rollback-Deck",
      noteTypes: [{ id: noteTypeId, name: "Basis", fields: ["Front", "Back"], templates: [] }],
      notes: [
        { id: 1, noteTypeId, fields: ["日本", "Japan"], tags: [] },
        { id: 2, noteTypeId, fields: ["学生", "Student"], tags: [] },
      ],
      cards: [
        { noteId: 1, ord: 0, type: 2, due: 0, ivl: 10, factor: 2500, reps: 3, lapses: 1 },
        { noteId: 2, ord: 0, type: 2, due: 0, ivl: 10, factor: 2500, reps: 3, lapses: 1 },
      ],
      // A NUL byte in the filename makes node's fs write throw, forcing a failure
      // partway through the transaction (after notes and cards were already inserted).
      media: new Map([[mediaFilename, new TextEncoder().encode("data")]]),
    };
  }

  it("rolls back notes, cards and scheduling when writing media fails mid-transaction", () => {
    const options = {
      skillId: "japanese",
      moduleId: "rollback-deck",
      moduleTitle: "Rollback-Deck",
      mapping: { [String(noteTypeId)]: { front: 0, back: 1, reading: null, note: null } },
      keepScheduling: false,
      mediaDir: join(dir, "media"),
    };

    expect(() => importApkg(database, contentWith("broken\0name.mp3"), options, Date.now())).toThrow();

    const notes = database.raw.prepare("SELECT COUNT(*) AS n FROM notes").get() as { n: number };
    const cards = database.raw.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number };
    const scheduling = database.raw.prepare("SELECT COUNT(*) AS n FROM scheduling").get() as { n: number };
    const skills = database.raw.prepare("SELECT COUNT(*) AS n FROM skills").get() as { n: number };
    const modules = database.raw.prepare("SELECT COUNT(*) AS n FROM modules").get() as { n: number };

    expect(notes.n).toBe(0);
    expect(cards.n).toBe(0);
    expect(scheduling.n).toBe(0);
    expect(skills.n).toBe(0);
    expect(modules.n).toBe(0);
  });

  it("succeeds and writes everything when nothing fails", () => {
    const options = {
      skillId: "japanese",
      moduleId: "ok-deck",
      moduleTitle: "OK-Deck",
      mapping: { [String(noteTypeId)]: { front: 0, back: 1, reading: null, note: null } },
      keepScheduling: false,
      mediaDir: join(dir, "media"),
    };

    const result = importApkg(database, contentWith("ok.mp3"), options, Date.now());
    expect(result).toEqual({ notes: 2, cards: 2, media: 1 });

    const cards = database.raw.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number };
    expect(cards.n).toBe(2);
  });
});
