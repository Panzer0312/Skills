import { zipSync } from "fflate";
import { describe, expect, it } from "vitest";
import { ApkgError, readApkg } from "./read.js";
import { buildTestApkg } from "./testDeck.js";

describe("readApkg", () => {
  it("reads notes, fields and tags from a legacy collection", () => {
    const bytes = buildTestApkg({
      deckName: "Japanisch Kern",
      notes: [
        { fields: ["日本", "Japan"], tags: ["land", "n5"] },
        { fields: ["学生", "Student"], tags: [] },
      ],
    });

    const content = readApkg(bytes);
    expect(content.deckName).toBe("Japanisch Kern");
    expect(content.notes).toHaveLength(2);
    expect(content.notes[0]?.fields).toEqual(["日本", "Japan"]);
    expect(content.notes[0]?.tags).toEqual(["land", "n5"]);
    expect(content.notes[1]?.tags).toEqual([]);
  });

  it("reads field names from the legacy models json", () => {
    const bytes = buildTestApkg({
      fieldNames: ["Ausdruck", "Bedeutung", "Lesung"],
      notes: [{ fields: ["日本", "Japan", "にほん"] }],
    });
    const content = readApkg(bytes);
    expect(content.noteTypes[0]?.fields).toEqual(["Ausdruck", "Bedeutung", "Lesung"]);
  });

  it("reads field names from the modern notetypes tables", () => {
    const bytes = buildTestApkg({
      legacySchema: false,
      fieldNames: ["Expression", "Meaning"],
      notes: [{ fields: ["犬", "Hund"] }],
    });
    const content = readApkg(bytes);
    expect(content.noteTypes[0]?.fields).toEqual(["Expression", "Meaning"]);
    expect(content.deckName).toBe("Testdeck");
  });

  it("produces one card per template per note", () => {
    const bytes = buildTestApkg({
      templates: ["Erkennen", "Produzieren"],
      notes: [{ fields: ["犬", "Hund"] }, { fields: ["猫", "Katze"] }],
    });
    const content = readApkg(bytes);
    expect(content.cards).toHaveLength(4);
    expect(new Set(content.cards.map((c) => c.ord))).toEqual(new Set([0, 1]));
  });

  it("maps media entries back to their original file names", () => {
    const bytes = buildTestApkg({
      notes: [{ fields: ["犬", "Hund"] }],
      media: { "hund.mp3": "AUDIO", "hund.jpg": "BILD" },
    });
    const content = readApkg(bytes);
    expect(new TextDecoder().decode(content.media.get("hund.mp3")!)).toBe("AUDIO");
    expect(new TextDecoder().decode(content.media.get("hund.jpg")!)).toBe("BILD");
  });

  it("rejects a zip without a collection", () => {
    const bytes = zipSync({ "readme.txt": new TextEncoder().encode("nichts") });
    expect(() => readApkg(bytes)).toThrowError(ApkgError);
    expect(() => readApkg(bytes)).toThrowError(/keine Anki-Sammlung/i);
  });

  it("names the fix when the collection is zstd-compressed", () => {
    const bytes = zipSync({ "collection.anki21b": new Uint8Array([1, 2, 3]) });
    expect(() => readApkg(bytes)).toThrowError(/ältere Anki-Versionen/i);
  });

  it("rejects data that is not a zip at all", () => {
    expect(() => readApkg(new Uint8Array([0, 1, 2, 3]))).toThrowError(ApkgError);
  });
});
