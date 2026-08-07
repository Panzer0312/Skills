import type { ChordShape } from "@skills/core";

export interface ChordOverrideEntry {
  id: number;
  scope: "global" | "song";
  songKey: string;
  symbol: string;
  name: string | null;
  frets: (number | null)[];
  fingers: (number | null)[];
  baseFret: number;
  updatedAt: number;
}

/** Shapes that take precedence over everything a skill ships, song level first. */
export interface ChordOverrides {
  song?: Record<string, ChordShape>;
  global?: Record<string, ChordShape>;
}

export function toShapeMap(entries: ChordOverrideEntry[]): Record<string, ChordShape> {
  const map: Record<string, ChordShape> = {};
  for (const entry of entries) {
    map[entry.symbol] = {
      name: entry.name ?? entry.symbol,
      frets: entry.frets,
      fingers: entry.fingers,
      baseFret: entry.baseFret,
    };
  }
  return map;
}
