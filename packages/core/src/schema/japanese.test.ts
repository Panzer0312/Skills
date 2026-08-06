import { describe, expect, it } from "vitest";
import { parseKanaFile } from "./japanese.js";

const entry = {
  kana: "あ",
  romaji: "a",
  strokes: 3,
  merksatz: "あ sieht aus wie ein A mit Schleife.",
  beispiel: { wort: "あめ", lesung: "ame", bedeutung: "Regen" },
};

describe("parseKanaFile", () => {
  it("accepts a well-formed entry", () => {
    const result = parseKanaFile({ script: "hiragana", entries: [entry] }, "kana/hiragana.json");
    expect(result.ok).toBe(true);
  });

  it("rejects an entry without a mnemonic", () => {
    const { merksatz, ...withoutMnemonic } = entry;
    const result = parseKanaFile(
      { script: "hiragana", entries: [withoutMnemonic] },
      "kana/hiragana.json",
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain("kana/hiragana.json");
  });

  it("rejects duplicate kana", () => {
    const result = parseKanaFile({ script: "hiragana", entries: [entry, entry] }, "k.json");
    expect(result.ok).toBe(false);
  });
});
