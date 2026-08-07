import { z } from "zod";
import { parseChord, transposeChord } from "./chords.js";

export type SongFormat = "chordpro" | "chordsheet" | "tab";

export const songLineSchema = z.object({
  lyrics: z.string(),
  chords: z.array(z.object({ position: z.number().int().nonnegative(), symbol: z.string() })),
});

export const tabLineSchema = z.object({ strings: z.array(z.string()).length(6) });

export const songSectionSchema = z.object({
  name: z.string(),
  lines: z.array(songLineSchema),
  tab: z.array(tabLineSchema),
});

export const songSchema = z.object({
  title: z.string().min(1),
  artist: z.string().nullable(),
  capo: z.number().int().nonnegative(),
  sections: z.array(songSectionSchema),
  chordsUsed: z.array(z.string()),
});

export type SongLine = z.infer<typeof songLineSchema>;
export type TabLine = z.infer<typeof tabLineSchema>;
export type SongSection = z.infer<typeof songSectionSchema>;
export type Song = z.infer<typeof songSchema>;

export function collectChords(sections: SongSection[]): string[] {
  const seen = new Set<string>();
  for (const section of sections) {
    for (const line of section.lines) {
      for (const chord of line.chords) seen.add(chord.symbol);
    }
  }
  return [...seen].sort();
}

export function transposeSong(song: Song, steps: number, preferFlats = false): Song {
  const sections = song.sections.map((section) => ({
    ...section,
    lines: section.lines.map((line) => ({
      ...line,
      chords: line.chords.map((chord) => ({
        ...chord,
        symbol: transposeChord(chord.symbol, steps, preferFlats),
      })),
    })),
  }));
  return { ...song, sections, chordsUsed: collectChords(sections) };
}

export function isChordToken(token: string): boolean {
  return parseChord(token) !== null;
}
