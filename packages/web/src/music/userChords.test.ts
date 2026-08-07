import { describe, expect, it } from "vitest";
import { resolveUserChords } from "./userChords.js";

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
