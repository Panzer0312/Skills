import { describe, expect, it } from "vitest";
import { detectFormat, parseSong, transposeSong } from "./index.js";

const chordPro = `{title: Übung in Em}
{artist: Eigene Übung}
{capo: 0}

{start_of_verse}
[Em]Erste Zeile mit [Am]zwei Akkorden
[Em]Zweite Zeile
{end_of_verse}

{start_of_chorus}
[G]Refrain [D]hier
{end_of_chorus}`;

const chordSheet = `Übung in G
Eigene Übung

[Strophe]
G                C
Erste Zeile hier
G          D
Zweite Zeile

[Refrain]
Em        C
Refrainzeile`;

const tab = `Riff in E
Eigene Übung

e|-----------------|
B|-----------------|
G|-----------------|
D|--2--2--2--2-----|
A|--2--2--2--2-----|
E|--0--0--0--0-----|`;

describe("detectFormat", () => {
  it("recognises chordpro by its directives and inline chords", () => {
    expect(detectFormat(chordPro)).toBe("chordpro");
    expect(detectFormat("[C]Hallo Welt")).toBe("chordpro");
  });

  it("recognises tablature by its string lines", () => {
    expect(detectFormat(tab)).toBe("tab");
  });

  it("falls back to a chord sheet", () => {
    expect(detectFormat(chordSheet)).toBe("chordsheet");
  });
});

describe("parseSong: chordpro", () => {
  const song = parseSong(chordPro);

  it("reads title, artist and capo", () => {
    expect(song.title).toBe("Übung in Em");
    expect(song.artist).toBe("Eigene Übung");
    expect(song.capo).toBe(0);
  });

  it("splits into named sections", () => {
    expect(song.sections.map((s) => s.name)).toEqual(["Strophe", "Refrain"]);
  });

  it("keeps the lyrics free of chord markers and records chord positions", () => {
    const first = song.sections[0]!.lines[0]!;
    expect(first.lyrics).toBe("Erste Zeile mit zwei Akkorden");
    expect(first.chords).toEqual([
      { position: 0, symbol: "Em" },
      { position: 16, symbol: "Am" },
    ]);
  });

  it("collects the chords used in the song", () => {
    expect(song.chordsUsed).toEqual(["Am", "D", "Em", "G"]);
  });
});

describe("parseSong: chord sheet", () => {
  const song = parseSong(chordSheet);

  it("takes the first two lines as title and artist", () => {
    expect(song.title).toBe("Übung in G");
    expect(song.artist).toBe("Eigene Übung");
  });

  it("keeps bracketed section names", () => {
    expect(song.sections.map((s) => s.name)).toEqual(["Strophe", "Refrain"]);
  });

  it("aligns chords to the column they stood in", () => {
    const first = song.sections[0]!.lines[0]!;
    expect(first.lyrics).toBe("Erste Zeile hier");
    expect(first.chords).toEqual([
      { position: 0, symbol: "G" },
      { position: 17, symbol: "C" },
    ]);
  });
});

describe("parseSong: tab", () => {
  const song = parseSong(tab);

  it("keeps the six string lines together", () => {
    expect(song.title).toBe("Riff in E");
    expect(song.sections[0]!.tab).toHaveLength(1);
    expect(song.sections[0]!.tab[0]!.strings).toHaveLength(6);
    expect(song.sections[0]!.tab[0]!.strings[5]).toContain("--0--0--0--0--");
  });
});

describe("transposeSong", () => {
  it("moves every chord and updates the chord list", () => {
    const song = transposeSong(parseSong(chordPro), 2);
    expect(song.sections[0]!.lines[0]!.chords[0]!.symbol).toBe("F#m");
    expect(song.chordsUsed).toEqual(["A", "Bm", "E", "F#m"]);
  });

  it("leaves tablature untouched", () => {
    const song = transposeSong(parseSong(tab), 2);
    expect(song.sections[0]!.tab[0]!.strings[5]).toContain("--0--0--0--0--");
  });
});
