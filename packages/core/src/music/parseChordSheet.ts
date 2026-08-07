import { collectChords, isChordToken, type Song, type SongLine, type SongSection } from "./song.js";

const SECTION_HEADER = /^\s*\[([^\]]+)\]\s*$/;

/** A line counts as a chord line when every token on it parses as a chord. */
function isChordLine(line: string): boolean {
  const tokens = line.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return false;
  return tokens.every(isChordToken);
}

function chordsWithPositions(line: string): { position: number; symbol: string }[] {
  const result: { position: number; symbol: string }[] = [];
  const pattern = /\S+/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(line)) !== null) {
    result.push({ position: match.index, symbol: match[0] });
  }
  return result;
}

export function parseChordSheet(text: string): Song {
  const lines = text.split(/\r?\n/);

  let index = 0;
  while (index < lines.length && lines[index]!.trim() === "") index += 1;

  const title = lines[index]?.trim() || "Ohne Titel";
  index += 1;

  let artist: string | null = null;
  const candidate = lines[index]?.trim() ?? "";
  if (candidate !== "" && !SECTION_HEADER.test(candidate) && !isChordLine(candidate)) {
    artist = candidate;
    index += 1;
  }

  const sections: SongSection[] = [];
  let current: SongSection = { name: "Song", lines: [], tab: [] };
  const push = () => {
    if (current.lines.length > 0) sections.push(current);
  };

  for (; index < lines.length; index += 1) {
    const raw = lines[index]!;

    const header = SECTION_HEADER.exec(raw);
    if (header) {
      push();
      current = { name: header[1]!.trim(), lines: [], tab: [] };
      continue;
    }

    if (raw.trim() === "") continue;

    if (isChordLine(raw)) {
      const chords = chordsWithPositions(raw);
      const next = lines[index + 1];
      if (next !== undefined && next.trim() !== "" && !isChordLine(next) && !SECTION_HEADER.test(next)) {
        current.lines.push({ lyrics: next.trimEnd(), chords });
        index += 1;
      } else {
        current.lines.push({ lyrics: "", chords });
      }
      continue;
    }

    const line: SongLine = { lyrics: raw.trimEnd(), chords: [] };
    current.lines.push(line);
  }

  push();
  if (sections.length === 0) sections.push({ name: "Song", lines: [], tab: [] });

  return { title, artist, capo: 0, sections, chordsUsed: collectChords(sections) };
}
