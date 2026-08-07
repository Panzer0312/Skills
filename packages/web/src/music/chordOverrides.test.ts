import { describe, expect, it } from "vitest";
import { toShapeMap, type ChordOverrideEntry } from "./chordOverrides.js";

const entry: ChordOverrideEntry = {
  id: 1,
  scope: "global",
  songKey: "",
  symbol: "F#m",
  name: "F#m (leichter)",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
  updatedAt: 0,
};

describe("toShapeMap", () => {
  it("keys the shapes by symbol", () => {
    expect(toShapeMap([entry])["F#m"]).toEqual({
      name: "F#m (leichter)",
      frets: entry.frets,
      fingers: entry.fingers,
      baseFret: 1,
    });
  });

  it("falls back to the symbol when no name is stored", () => {
    expect(toShapeMap([{ ...entry, name: null }])["F#m"]?.name).toBe("F#m");
  });
});
