import { collectChords, type Song, type SongSection } from "./song.js";

const DIRECTIVE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
const INLINE_CHORD = /\[([^\]]+)\]/g;

const SECTION_NAMES: Record<string, string> = {
  verse: "Strophe",
  chorus: "Refrain",
  bridge: "Bridge",
  intro: "Intro",
  outro: "Outro",
};

export function parseChordPro(text: string): Song {
  let title = "Ohne Titel";
  let artist: string | null = null;
  let capo = 0;

  const sections: SongSection[] = [];
  let current: SongSection = { name: "Song", lines: [], tab: [] };

  const push = () => {
    if (current.lines.length > 0 || current.tab.length > 0) sections.push(current);
  };

  for (const raw of text.split(/\r?\n/)) {
    const directive = DIRECTIVE.exec(raw);
    if (directive) {
      const key = directive[1]!.toLowerCase();
      const value = directive[2]?.trim() ?? "";

      if (key === "title" || key === "t") title = value;
      else if (key === "artist" || key === "subtitle" || key === "st") artist = value;
      else if (key === "capo") capo = Number(value) || 0;
      else if (key.startsWith("start_of_")) {
        push();
        const suffix = key.slice("start_of_".length);
        current = { name: SECTION_NAMES[suffix] ?? suffix, lines: [], tab: [] };
      } else if (key.startsWith("end_of_")) {
        push();
        current = { name: "Song", lines: [], tab: [] };
      }
      continue;
    }

    if (raw.trim() === "") continue;

    const chords: { position: number; symbol: string }[] = [];
    let lyrics = "";
    let cursor = 0;
    INLINE_CHORD.lastIndex = 0;

    let match: RegExpExecArray | null;
    while ((match = INLINE_CHORD.exec(raw)) !== null) {
      lyrics += raw.slice(cursor, match.index);
      chords.push({ position: lyrics.length, symbol: match[1]!.trim() });
      cursor = match.index + match[0].length;
    }
    lyrics += raw.slice(cursor);

    current.lines.push({ lyrics: lyrics.trim(), chords });
  }

  push();
  if (sections.length === 0) sections.push({ name: "Song", lines: [], tab: [] });

  return { title, artist, capo, sections, chordsUsed: collectChords(sections) };
}
