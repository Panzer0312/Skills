import { describe, expect, it } from "vitest";
import { parseDeckFile } from "./content.js";

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
