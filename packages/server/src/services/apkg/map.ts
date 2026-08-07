import type { ApkgNoteType } from "./read.js";

export interface FieldMapping {
  front: number;
  back: number;
  reading: number | null;
  note: number | null;
}

const FRONT = ["expression", "ausdruck", "front", "vorderseite", "word", "wort", "kanji", "japanese", "japanisch"];
const BACK = ["meaning", "bedeutung", "back", "rückseite", "ruckseite", "translation", "übersetzung", "deutsch", "english"];
const READING = ["reading", "lesung", "kana", "furigana", "pronunciation", "aussprache"];
const NOTE = ["notes", "note", "notiz", "hinweis", "comment", "kommentar"];

function findField(fields: string[], needles: string[], exclude: number[]): number | null {
  for (let i = 0; i < fields.length; i += 1) {
    if (exclude.includes(i)) continue;
    const name = fields[i]!.toLowerCase();
    if (needles.some((needle) => name.includes(needle))) return i;
  }
  return null;
}

export function guessMapping(noteType: ApkgNoteType): FieldMapping {
  const fields = noteType.fields;
  if (fields.length === 0) return { front: 0, back: 0, reading: null, note: null };
  if (fields.length === 1) return { front: 0, back: 0, reading: null, note: null };

  const front = findField(fields, FRONT, []) ?? 0;
  const back = findField(fields, BACK, [front]) ?? (front === 0 ? 1 : 0);
  const reading = findField(fields, READING, [front, back]);
  const note = findField(fields, NOTE, [front, back, ...(reading === null ? [] : [reading])]);

  return { front, back, reading, note };
}
