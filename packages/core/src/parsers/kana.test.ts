import { describe, expect, it } from "vitest";
import { isKana, kanaToRomaji, romajiToKana, toHiragana, toKatakana } from "./kana.js";

describe("kanaToRomaji", () => {
  it("transliterates plain syllables in Hepburn", () => {
    expect(kanaToRomaji("さくら")).toBe("sakura");
    expect(kanaToRomaji("しつもん")).toBe("shitsumon");
    expect(kanaToRomaji("ふじ")).toBe("fuji");
  });

  it("handles yōon", () => {
    expect(kanaToRomaji("きゃく")).toBe("kyaku");
    expect(kanaToRomaji("じゃあ")).toBe("jaa");
    expect(kanaToRomaji("しゅくだい")).toBe("shukudai");
  });

  it("doubles the consonant after small tsu", () => {
    expect(kanaToRomaji("がっこう")).toBe("gakkou");
    expect(kanaToRomaji("きっぷ")).toBe("kippu");
  });

  it("expands the katakana length mark", () => {
    expect(kanaToRomaji("コーヒー")).toBe("koohii");
    expect(kanaToRomaji("ケーキ")).toBe("keeki");
  });

  it("keeps n as n before labials", () => {
    expect(kanaToRomaji("しんぶん")).toBe("shinbun");
    expect(kanaToRomaji("さんぽ")).toBe("sanpo");
  });

  it("reads particles by context only when asked", () => {
    expect(kanaToRomaji("わたしはがくせいです", { particles: true })).toBe("watashiwagakuseidesu");
    expect(kanaToRomaji("わたしはがくせいです")).toBe("watashihagakuseidesu");
    expect(kanaToRomaji("がっこうへいく", { particles: true })).toBe("gakkoueiku");
    expect(kanaToRomaji("ほんをよむ", { particles: true })).toBe("honoyomu");
  });

  it("leaves non-kana characters untouched", () => {
    expect(kanaToRomaji("日本ご")).toBe("日本go");
  });
});

describe("romajiToKana", () => {
  it("writes hiragana and katakana", () => {
    expect(romajiToKana("sakura", "hiragana")).toBe("さくら");
    expect(romajiToKana("koohii", "katakana")).toBe("コーヒー");
  });

  it("round-trips yōon and gemination", () => {
    expect(romajiToKana("kyaku", "hiragana")).toBe("きゃく");
    expect(romajiToKana("gakkou", "hiragana")).toBe("がっこう");
  });
});

describe("script helpers", () => {
  it("converts between the two scripts", () => {
    expect(toKatakana("さくら")).toBe("サクラ");
    expect(toHiragana("サクラ")).toBe("さくら");
  });

  it("recognises kana", () => {
    expect(isKana("あ")).toBe(true);
    expect(isKana("ア")).toBe(true);
    expect(isKana("日")).toBe(false);
  });
});
