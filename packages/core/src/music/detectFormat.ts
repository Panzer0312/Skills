import type { SongFormat } from "./song.js";

const TAB_LINE = /^\s*[eEBGDAa][|:]/;

export function detectFormat(text: string): SongFormat {
  const lines = text.split(/\r?\n/);

  if (lines.filter((line) => TAB_LINE.test(line)).length >= 4) return "tab";
  if (lines.some((line) => /^\s*\{[a-z_]+\s*:?/i.test(line))) return "chordpro";
  if (lines.some((line) => /\[[A-G][#b]?[^\]]*\]\S/.test(line))) return "chordpro";

  return "chordsheet";
}
