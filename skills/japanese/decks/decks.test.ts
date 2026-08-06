import { parseDeckFile, isKana } from "@skills/core";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith(".json"));

describe("vocabulary decks", () => {
  it("ships eight themed decks", () => {
    expect(files).toHaveLength(8);
  });

  for (const file of files) {
    describe(file, () => {
      const raw = JSON.parse(readFileSync(join(here, file), "utf8")) as unknown;

      it("parses", () => {
        const parsed = parseDeckFile(raw, file);
        expect(parsed.ok).toBe(true);
      });

      it("holds at least 30 cards", () => {
        const parsed = parseDeckFile(raw, file);
        if (!parsed.ok) throw new Error(parsed.error);
        expect(parsed.deck.cards.length).toBeGreaterThanOrEqual(30);
      });

      it("gives every card a kana reading, an example and tags", () => {
        const parsed = parseDeckFile(raw, file);
        if (!parsed.ok) throw new Error(parsed.error);
        for (const card of parsed.deck.cards) {
          expect(card.reading, `${card.key} ohne Lesung`).toBeTruthy();
          expect([...card.reading!].every((c) => isKana(c) || c === "ー")).toBe(true);
          expect(card.example, `${card.key} ohne Beispielsatz`).toBeTruthy();
          expect(card.tags.length).toBeGreaterThan(0);
        }
      });

      it("uses the kana reading as the stable key", () => {
        const parsed = parseDeckFile(raw, file);
        if (!parsed.ok) throw new Error(parsed.error);
        for (const card of parsed.deck.cards) {
          expect(card.key).toBe(card.reading);
        }
      });
    });
  }
});
