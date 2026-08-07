import { describe, expect, it } from "vitest";
import { guessMapping } from "./map.js";

describe("guessMapping", () => {
  it("recognises common japanese deck field names", () => {
    const mapping = guessMapping({
      id: 1,
      name: "Core",
      fields: ["Expression", "Meaning", "Reading", "Notes"],
      templates: [],
    });
    expect(mapping).toEqual({ front: 0, back: 1, reading: 2, note: 3 });
  });

  it("recognises german field names regardless of case", () => {
    const mapping = guessMapping({
      id: 1,
      name: "Vokabeln",
      fields: ["bedeutung", "AUSDRUCK", "Lesung"],
      templates: [],
    });
    expect(mapping).toEqual({ front: 1, back: 0, reading: 2, note: null });
  });

  it("falls back to the first two fields when nothing matches", () => {
    const mapping = guessMapping({ id: 1, name: "X", fields: ["A", "B", "C"], templates: [] });
    expect(mapping).toEqual({ front: 0, back: 1, reading: null, note: null });
  });

  it("uses the only field for both sides when a note type has one field", () => {
    const mapping = guessMapping({ id: 1, name: "X", fields: ["Nur eins"], templates: [] });
    expect(mapping).toEqual({ front: 0, back: 0, reading: null, note: null });
  });
});
