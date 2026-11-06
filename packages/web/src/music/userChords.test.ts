import { describe, expect, it } from "vitest";
import { resolveChordShape, resolveUserChords } from "./userChords.js";

const validEntry = {
  symbol: "Cadd9",
  name: "Cadd9",
  frets: [null, 3, 2, 0, 3, 0],
  fingers: [null, 3, 2, null, 4, null],
  baseFret: 1,
};

describe("resolveUserChords", () => {
  it("builds a symbol -> shape map from valid chord files", () => {
    const { chords, warnings } = resolveUserChords({
      "/skills/guitar/chords/eigene.json": { default: [validEntry] },
    });
    expect(warnings).toHaveLength(0);
    expect(chords.Cadd9).toEqual({
      name: "Cadd9",
      frets: validEntry.frets,
      fingers: validEntry.fingers,
      baseFret: 1,
    });
  });

  it("skips an invalid file with a warning instead of throwing", () => {
    expect(() =>
      resolveUserChords({
        "/skills/guitar/chords/kaputt.json": { default: [{ ...validEntry, frets: [1, 2, 3] }] },
      }),
    ).not.toThrow();

    const { chords, warnings } = resolveUserChords({
      "/skills/guitar/chords/kaputt.json": { default: [{ ...validEntry, frets: [1, 2, 3] }] },
      "/skills/guitar/chords/eigene.json": { default: [validEntry] },
    });
    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain("kaputt.json");
    expect(chords.Cadd9).toBeDefined();
  });

  it("falls back to the symbol as the display name when name is omitted", () => {
    const { chords } = resolveUserChords({
      "/skills/guitar/chords/eigene.json": { default: [{ ...validEntry, name: undefined }] },
    });
    expect(chords.Cadd9?.name).toBe("Cadd9");
  });
});

const barreShape = {
  name: "F#m eigen",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
};

describe("resolveChordShape", () => {
  it("prefers a song override over a global one", () => {
    const shape = resolveChordShape("Em", {
      song: { Em: { ...barreShape, name: "nur hier" } },
      global: { Em: { ...barreShape, name: "überall" } },
    });
    expect(shape?.name).toBe("nur hier");
  });

  it("uses the global override when the song has none", () => {
    const shape = resolveChordShape("Em", { global: { Em: { ...barreShape, name: "überall" } } });
    expect(shape?.name).toBe("überall");
  });

  it("keeps the shipped resolution when no override applies", () => {
    expect(resolveChordShape("Em", { song: {}, global: {} })).toEqual(resolveChordShape("Em"));
    expect(resolveChordShape("Em")?.frets).toHaveLength(6);
  });

  it("draws Em7 as the shipped open grip, not as a barre at fret 0", () => {
    expect(resolveChordShape("Em7")).toEqual({
      name: "Em7",
      frets: [0, 2, 2, 0, 3, 0],
      fingers: [null, 1, 2, null, 3, null],
      baseFret: 1,
    });
  });

  it("returns null for a symbol nothing can resolve", () => {
    expect(resolveChordShape("Hglurb", {})).toBeNull();
  });
});
