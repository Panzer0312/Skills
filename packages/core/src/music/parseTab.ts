import { collectChords, type Song, type SongSection, type TabLine } from "./song.js";

const TAB_LINE = /^\s*[eEBGDAa][|:]/;

export function parseTab(text: string): Song {
  const lines = text.split(/\r?\n/);

  let index = 0;
  while (index < lines.length && lines[index]!.trim() === "") index += 1;

  const title = lines[index]?.trim() || "Ohne Titel";
  index += 1;

  let artist: string | null = null;
  const candidate = lines[index]?.trim() ?? "";
  if (candidate !== "" && !TAB_LINE.test(candidate)) {
    artist = candidate;
    index += 1;
  }

  const tab: TabLine[] = [];
  let buffer: string[] = [];

  for (; index < lines.length; index += 1) {
    const raw = lines[index]!;
    if (TAB_LINE.test(raw)) {
      buffer.push(raw.trimEnd());
      if (buffer.length === 6) {
        tab.push({ strings: [...buffer] });
        buffer = [];
      }
      continue;
    }
    if (raw.trim() === "" && buffer.length > 0) {
      while (buffer.length < 6) buffer.push("");
      tab.push({ strings: [...buffer] });
      buffer = [];
    }
  }

  if (buffer.length > 0) {
    while (buffer.length < 6) buffer.push("");
    tab.push({ strings: buffer });
  }

  const sections: SongSection[] = [{ name: "Riff", lines: [], tab }];
  return { title, artist, capo: 0, sections, chordsUsed: collectChords(sections) };
}
