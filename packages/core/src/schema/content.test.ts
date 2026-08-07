import { describe, expect, it } from "vitest";
import { parseChordFile, parseDeckFile } from "./content.js";

describe("parseDeckFile", () => {
  it("parses a deck and defaults tags to an empty array", () => {
    const result = parseDeckFile(
      { deck: "Zahlen", cards: [{ key: "ichi", front: "一", back: "eins", reading: "いち" }] },
      "decks/zahlen.json",
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.deck.cards[0]?.tags).toEqual([]);
      expect(result.deck.cards[0]?.reading).toBe("いち");
    }
  });

  it("rejects duplicate card keys and names the source file", () => {
    const result = parseDeckFile(
      { deck: "X", cards: [{ key: "a", front: "1", back: "1" }, { key: "a", front: "2", back: "2" }] },
      "decks/x.json",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("decks/x.json");
      expect(result.error).toContain("a");
    }
  });

  it("rejects a card without a key", () => {
    const result = parseDeckFile({ deck: "X", cards: [{ front: "1", back: "1" }] }, "decks/x.json");
    expect(result.ok).toBe(false);
  });
});

describe("parseChordFile", () => {
  const validEntry = {
    symbol: "F",
    name: "F (Barré)",
    frets: [1, 3, 3, 2, 1, 1],
    fingers: [1, 3, 4, 2, 1, 1],
    baseFret: 1,
  };

  it("parses a list of chord shapes", () => {
    const result = parseChordFile([validEntry], "chords/eigene.json");
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.entries).toHaveLength(1);
      expect(result.entries[0]?.symbol).toBe("F");
    }
  });

  it("allows null for muted strings and open strings at fret 0", () => {
    const entry = { ...validEntry, frets: [null, 0, 2, 2, 1, 0], fingers: [null, null, 2, 3, 1, null] };
    const result = parseChordFile([entry], "chords/eigene.json");
    expect(result.ok).toBe(true);
  });

  it("rejects a frets array that is not length 6", () => {
    const entry = { ...validEntry, frets: [1, 3, 3, 2, 1] };
    const result = parseChordFile([entry], "chords/eigene.json");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("chords/eigene.json");
    }
  });

  it("rejects an out-of-range fret", () => {
    const entry = { ...validEntry, frets: [1, 3, 3, 2, 1, 99] };
    const result = parseChordFile([entry], "chords/eigene.json");
    expect(result.ok).toBe(false);
  });

  it("rejects an entry without a symbol", () => {
    const entry = { ...validEntry, symbol: "" };
    const result = parseChordFile([entry], "chords/eigene.json");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-array payload", () => {
    const result = parseChordFile({ F: validEntry }, "chords/eigene.json");
    expect(result.ok).toBe(false);
  });
});
