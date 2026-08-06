const BASE: Record<string, string> = {
  あ: "a", い: "i", う: "u", え: "e", お: "o",
  か: "ka", き: "ki", く: "ku", け: "ke", こ: "ko",
  が: "ga", ぎ: "gi", ぐ: "gu", げ: "ge", ご: "go",
  さ: "sa", し: "shi", す: "su", せ: "se", そ: "so",
  ざ: "za", じ: "ji", ず: "zu", ぜ: "ze", ぞ: "zo",
  た: "ta", ち: "chi", つ: "tsu", て: "te", と: "to",
  だ: "da", ぢ: "ji", づ: "zu", で: "de", ど: "do",
  な: "na", に: "ni", ぬ: "nu", ね: "ne", の: "no",
  は: "ha", ひ: "hi", ふ: "fu", へ: "he", ほ: "ho",
  ば: "ba", び: "bi", ぶ: "bu", べ: "be", ぼ: "bo",
  ぱ: "pa", ぴ: "pi", ぷ: "pu", ぺ: "pe", ぽ: "po",
  ま: "ma", み: "mi", む: "mu", め: "me", も: "mo",
  や: "ya", ゆ: "yu", よ: "yo",
  ら: "ra", り: "ri", る: "ru", れ: "re", ろ: "ro",
  わ: "wa", を: "wo", ん: "n",
  ゃ: "ya", ゅ: "yu", ょ: "yo", ぁ: "a", ぃ: "i", ぅ: "u", ぇ: "e", ぉ: "o",
};

const YOON_STEM: Record<string, string> = {
  き: "ky", ぎ: "gy", し: "sh", じ: "j", ち: "ch", ぢ: "j", に: "ny",
  ひ: "hy", び: "by", ぴ: "py", み: "my", り: "ry",
};

const SMALL_Y: Record<string, string> = { ゃ: "a", ゅ: "u", ょ: "o" };

const HIRAGANA_START = 0x3041;
const HIRAGANA_END = 0x3096;
const KATAKANA_START = 0x30a1;
const KATAKANA_END = 0x30f6;
const SHIFT = KATAKANA_START - HIRAGANA_START;

export function isKana(char: string): boolean {
  const code = char.codePointAt(0);
  if (code === undefined) return false;
  return (
    (code >= HIRAGANA_START && code <= HIRAGANA_END) ||
    (code >= KATAKANA_START && code <= KATAKANA_END) ||
    char === "ー"
  );
}

export function toHiragana(input: string): string {
  return [...input]
    .map((char) => {
      const code = char.codePointAt(0)!;
      return code >= KATAKANA_START && code <= KATAKANA_END
        ? String.fromCodePoint(code - SHIFT)
        : char;
    })
    .join("");
}

export function toKatakana(input: string): string {
  return [...input]
    .map((char) => {
      const code = char.codePointAt(0)!;
      return code >= HIRAGANA_START && code <= HIRAGANA_END
        ? String.fromCodePoint(code + SHIFT)
        : char;
    })
    .join("");
}

export function kanaToRomaji(input: string, options: { particles?: boolean } = {}): string {
  const chars = [...toHiragana(input)];
  const out: string[] = [];
  let pendingGemination = false;

  for (let i = 0; i < chars.length; i += 1) {
    const char = chars[i]!;

    if (char === "っ") {
      pendingGemination = true;
      continue;
    }

    if (char === "ー") {
      const last = out[out.length - 1];
      if (last) out.push(last[last.length - 1]!);
      continue;
    }

    let syllable: string | null = null;
    const next = chars[i + 1];

    if (next && SMALL_Y[next] && YOON_STEM[char]) {
      syllable = `${YOON_STEM[char]}${SMALL_Y[next]}`;
      i += 1;
    } else if (BASE[char]) {
      syllable = BASE[char]!;
      if (options.particles) {
        if (char === "は" && i > 0) syllable = "wa";
        else if (char === "へ" && i > 0) syllable = "e";
        else if (char === "を") syllable = "o";
      }
    }

    if (syllable === null) {
      out.push(char);
      pendingGemination = false;
      continue;
    }

    if (pendingGemination) {
      syllable = `${syllable[0]}${syllable}`;
      pendingGemination = false;
    }

    out.push(syllable);
  }

  return out.join("");
}

const REVERSE_LOOKUP: [string, string][] = [];
for (const [stem, prefix] of Object.entries(YOON_STEM)) {
  for (const [small, vowel] of Object.entries(SMALL_Y)) {
    REVERSE_LOOKUP.push([`${prefix}${vowel}`, `${stem}${small}`]);
  }
}
for (const [kana, romaji] of Object.entries(BASE)) {
  REVERSE_LOOKUP.push([romaji, kana]);
}
REVERSE_LOOKUP.sort((a, b) => b[0].length - a[0].length);

export function romajiToKana(input: string, script: "hiragana" | "katakana"): string {
  let rest = input.toLowerCase();
  let out = "";

  while (rest.length > 0) {
    const doubled = /^([kstpgzdbhfmyrwjc])\1/.exec(rest);
    if (doubled) {
      out += "っ";
      rest = rest.slice(1);
      continue;
    }

    const previousVowel = /[aeiou]$/.exec(out.length > 0 ? kanaToRomaji(out) : "");
    if (previousVowel && rest.startsWith(previousVowel[0]) && script === "katakana") {
      out += "ー";
      rest = rest.slice(1);
      continue;
    }

    const match = REVERSE_LOOKUP.find(([romaji]) => rest.startsWith(romaji));
    if (!match) {
      out += rest[0];
      rest = rest.slice(1);
      continue;
    }
    out += match[1];
    rest = rest.slice(match[0].length);
  }

  return script === "katakana" ? toKatakana(out) : out;
}
