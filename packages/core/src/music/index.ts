export * from "./notes.js";
export * from "./chords.js";
export * from "./scales.js";
export * from "./jam.js";
export * from "./song.js";
export * from "./detectFormat.js";
export * from "./parseChordPro.js";
export * from "./parseChordSheet.js";
export * from "./parseTab.js";

import { detectFormat } from "./detectFormat.js";
import { parseChordPro } from "./parseChordPro.js";
import { parseChordSheet } from "./parseChordSheet.js";
import { parseTab } from "./parseTab.js";
import type { Song } from "./song.js";

export function parseSong(text: string): Song {
  switch (detectFormat(text)) {
    case "chordpro":
      return parseChordPro(text);
    case "tab":
      return parseTab(text);
    case "chordsheet":
      return parseChordSheet(text);
  }
}
