import { describe, expect, it } from "vitest";
import { kanaToRomaji } from "@skills/core";
import { parseKanaFile } from "@skills/core";
import hiragana from "./hiragana.json";
import katakana from "./katakana.json";

describe("kana data files", () => {
  for (const [name, file] of [
    ["hiragana", hiragana],
    ["katakana", katakana],
  ] as const) {
    it(`${name}: parses and covers the full syllabary`, () => {
      const parsed = parseKanaFile(file, `${name}.json`);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) return;
      expect(parsed.file.entries.length).toBeGreaterThanOrEqual(104);
    });

    it(`${name}: every romaji matches the transliterator`, () => {
      const parsed = parseKanaFile(file, `${name}.json`);
      if (!parsed.ok) throw new Error(parsed.error);
      for (const entry of parsed.file.entries) {
        expect(kanaToRomaji(entry.kana)).toBe(entry.romaji);
      }
    });

    it(`${name}: every entry carries a German mnemonic`, () => {
      const parsed = parseKanaFile(file, `${name}.json`);
      if (!parsed.ok) throw new Error(parsed.error);
      for (const entry of parsed.file.entries) {
        expect(entry.merksatz.length).toBeGreaterThan(10);
      }
    });
  }
});
