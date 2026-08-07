import { newSchedulingState, type SchedulingState } from "@skills/core";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { AppDatabase } from "../../db/client.js";
import type { FieldMapping } from "./map.js";
import type { ApkgContent } from "./read.js";

export interface ImportOptions {
  skillId: string;
  moduleId: string;
  moduleTitle: string;
  mapping: Record<string, FieldMapping>;
  keepScheduling: boolean;
  mediaDir: string;
}

export interface ImportResult {
  notes: number;
  cards: number;
  media: number;
}

const DAY = 86_400_000;

/** Strips Anki's HTML and sound references so plain text remains. */
function clean(value: string): string {
  return value
    .replace(/\[sound:[^\]]+\]/g, "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .trim();
}

function schedulingFromAnki(card: ApkgContent["cards"][number], now: number): SchedulingState {
  const stability = Math.max(0.1, card.ivl);
  const difficulty = Math.min(10, Math.max(1, 11 - card.factor / 400));
  return {
    state: "review",
    due: now + Math.max(0, card.ivl) * DAY,
    stability,
    difficulty,
    reps: card.reps,
    lapses: card.lapses,
    lastReview: now,
  };
}

export function importApkg(
  database: AppDatabase,
  content: ApkgContent,
  options: ImportOptions,
  now: number,
): ImportResult {
  const { raw } = database;
  const notesById = new Map(content.notes.map((note) => [note.id, note]));
  const result: ImportResult = { notes: 0, cards: 0, media: 0 };

  const run = raw.transaction(() => {
    raw
      .prepare("INSERT INTO skills (id, installed_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
      .run(options.skillId, now);
    raw
      .prepare(
        `INSERT INTO modules (id, skill_id, type, title) VALUES (?, ?, 'srs-deck', ?)
         ON CONFLICT(skill_id, id) DO UPDATE SET title = excluded.title`,
      )
      .run(options.moduleId, options.skillId, options.moduleTitle);

    const insertNote = raw.prepare(
      "INSERT INTO notes (skill_id, fields_json, source_apkg) VALUES (?, ?, ?)",
    );
    const insertCard = raw.prepare(
      `INSERT INTO cards (skill_id, module_id, card_key, note_id, front_json, back_json, tags, state)
       VALUES (?, ?, ?, ?, ?, ?, ?, 'active')
       ON CONFLICT(skill_id, module_id, card_key) DO UPDATE SET
         front_json = excluded.front_json, back_json = excluded.back_json,
         tags = excluded.tags, state = 'active'`,
    );
    const insertScheduling = raw.prepare(
      `INSERT INTO scheduling (card_id, state, due, stability, difficulty, reps, lapses, last_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT(card_id) DO NOTHING`,
    );
    const findCard = raw.prepare(
      "SELECT id FROM cards WHERE skill_id = ? AND module_id = ? AND card_key = ?",
    );

    for (const note of content.notes) {
      insertNote.run(options.skillId, JSON.stringify(note.fields), options.moduleTitle);
      result.notes += 1;
    }

    for (const card of content.cards) {
      const note = notesById.get(card.noteId);
      if (!note) continue;
      const mapping = options.mapping[String(note.noteTypeId)];
      if (!mapping) continue;

      const front = clean(note.fields[mapping.front] ?? "");
      const back = clean(note.fields[mapping.back] ?? "");
      if (front === "" || back === "") continue;

      const reading = mapping.reading === null ? null : clean(note.fields[mapping.reading] ?? "") || null;
      const noteText = mapping.note === null ? null : clean(note.fields[mapping.note] ?? "") || null;
      const cardKey = `apkg-${note.id}-${card.ord}`;

      insertCard.run(
        options.skillId,
        options.moduleId,
        cardKey,
        null,
        JSON.stringify({ text: front }),
        JSON.stringify({ text: back, reading, note: noteText, example: null }),
        JSON.stringify(note.tags),
      );

      const row = findCard.get(options.skillId, options.moduleId, cardKey) as { id: number };
      const state =
        options.keepScheduling && card.type === 2 ? schedulingFromAnki(card, now) : newSchedulingState(now);
      insertScheduling.run(
        row.id,
        state.state,
        state.due,
        state.stability,
        state.difficulty,
        state.reps,
        state.lapses,
        state.lastReview,
      );
      result.cards += 1;
    }

    if (content.media.size > 0) {
      mkdirSync(options.mediaDir, { recursive: true });
      const insertMedia = raw.prepare(
        "INSERT INTO media (filename, mime, sha256, path) VALUES (?, ?, ?, ?) ON CONFLICT(sha256) DO NOTHING",
      );
      for (const [filename, bytes] of content.media) {
        const sha = createHash("sha256").update(bytes).digest("hex");
        const target = join(options.mediaDir, `${sha}-${filename}`);
        writeFileSync(target, bytes);
        insertMedia.run(filename, "application/octet-stream", sha, target);
        result.media += 1;
      }
    }
  });

  run();
  return result;
}
