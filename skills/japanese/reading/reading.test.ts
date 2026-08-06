import { isKana, parseKanjiFile, parseSatzFile } from "@skills/core";
import { describe, expect, it } from "vitest";
import kanji from "./kanji.json";
import regeln from "./regeln.json";
import saetze from "./saetze.json";

describe("kanji data", () => {
  it("parses and ships 40 entries", () => {
    const parsed = parseKanjiFile(kanji, "kanji.json");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    expect(parsed.entries).toHaveLength(40);
  });

  it("gives every kanji at least one reading and a German mnemonic", () => {
    const parsed = parseKanjiFile(kanji, "kanji.json");
    if (!parsed.ok) throw new Error(parsed.error);
    for (const entry of parsed.entries) {
      expect(entry.on.length + entry.kun.length, `${entry.kanji} ohne Lesung`).toBeGreaterThan(0);
      expect(entry.merksatz.length).toBeGreaterThan(15);
    }
  });

  it("writes every reading in kana", () => {
    const parsed = parseKanjiFile(kanji, "kanji.json");
    if (!parsed.ok) throw new Error(parsed.error);
    for (const entry of parsed.entries) {
      for (const reading of [...entry.on, ...entry.kun]) {
        const stem = reading.split(".")[0]!;
        expect([...stem].every((c) => isKana(c)), `${entry.kanji}: ${reading}`).toBe(true);
      }
    }
  });

  it("labels every example with the reading type it demonstrates", () => {
    const parsed = parseKanjiFile(kanji, "kanji.json");
    if (!parsed.ok) throw new Error(parsed.error);
    for (const entry of parsed.entries) {
      const kinds = new Set(entry.beispiele.map((b) => b.lesungsart));
      if (entry.on.length > 0 && entry.kun.length > 0) {
        expect(kinds.size, `${entry.kanji} zeigt nur eine Lesungsart`).toBe(2);
      }
    }
  });
});

describe("reading rules", () => {
  it("covers on/kun choice and rendaku including Lyman's law", () => {
    const text = JSON.stringify(regeln);
    expect(text).toContain("Rendaku");
    expect(text).toContain("Lyman");
    expect(Array.isArray(regeln)).toBe(true);
    expect((regeln as unknown[]).length).toBeGreaterThanOrEqual(6);
  });
});

describe("sentences", () => {
  it("parses and covers all three levels", () => {
    const parsed = parseSatzFile(saetze, "saetze.json");
    expect(parsed.ok).toBe(true);
    if (!parsed.ok) return;
    const levels = parsed.saetze.reduce<Record<string, number>>((acc, s) => {
      acc[s.stufe] = (acc[s.stufe] ?? 0) + 1;
      return acc;
    }, {});
    expect(levels.wort).toBeGreaterThanOrEqual(20);
    expect(levels.satz).toBeGreaterThanOrEqual(30);
    expect(levels.absatz).toBeGreaterThanOrEqual(10);
  });

  it("explains the chosen reading for every token that contains a kanji", () => {
    const parsed = parseSatzFile(saetze, "saetze.json");
    if (!parsed.ok) throw new Error(parsed.error);
    for (const satz of parsed.saetze) {
      for (const token of satz.tokens) {
        const hasKanji = [...token.text].some((c) => !isKana(c) && /\p{Script=Han}/u.test(c));
        if (!hasKanji) continue;
        expect(token.lesung, `${satz.id}: ${token.text} ohne Lesung`).toBeTruthy();
        expect(token.begruendung, `${satz.id}: ${token.text} ohne Begründung`).toBeTruthy();
      }
    }
  });

  it("reassembles the sentence from its tokens", () => {
    const parsed = parseSatzFile(saetze, "saetze.json");
    if (!parsed.ok) throw new Error(parsed.error);
    for (const satz of parsed.saetze) {
      expect(satz.tokens.map((t) => t.text).join("")).toBe(satz.japanisch);
    }
  });
});
