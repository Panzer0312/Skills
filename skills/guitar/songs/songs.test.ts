import { OPEN_CHORDS, parseSong } from "@skills/core";
import { describe, expect, it } from "vitest";
import songs from "./uebungsstuecke.json";

interface Uebungsstueck {
  id: string;
  titel: string;
  stufe: number;
  benoetigteAkkorde: string[];
  bpm: number;
  format: string;
  quelle: string;
}

const stuecke = songs as Uebungsstueck[];

describe("practice songs", () => {
  it("ships twelve pieces with unique ids", () => {
    expect(stuecke).toHaveLength(12);
    expect(new Set(stuecke.map((s) => s.id)).size).toBe(12);
  });

  it("covers all four difficulty levels", () => {
    const byLevel = stuecke.reduce<Record<number, number>>((acc, s) => {
      acc[s.stufe] = (acc[s.stufe] ?? 0) + 1;
      return acc;
    }, {});
    expect(byLevel[1]).toBe(4);
    expect(byLevel[2]).toBe(4);
    expect(byLevel[3]).toBe(2);
    expect(byLevel[4]).toBe(2);
  });

  it("parses every piece", () => {
    for (const stueck of stuecke) {
      const parsed = parseSong(stueck.quelle);
      expect(parsed.title, stueck.id).toBeTruthy();
      expect(parsed.sections.length, stueck.id).toBeGreaterThan(0);
    }
  });

  it("declares exactly the chords its source uses", () => {
    for (const stueck of stuecke) {
      if (stueck.stufe >= 3) continue;
      const parsed = parseSong(stueck.quelle);
      expect(new Set(parsed.chordsUsed), stueck.id).toEqual(new Set(stueck.benoetigteAkkorde));
    }
  });

  it("uses only open chords up to level two", () => {
    for (const stueck of stuecke.filter((s) => s.stufe <= 2)) {
      for (const chord of stueck.benoetigteAkkorde) {
        expect(OPEN_CHORDS[chord], `${stueck.id}: ${chord} ist kein offener Akkord`).toBeDefined();
      }
    }
  });

  it("gives every piece a practice tempo", () => {
    for (const stueck of stuecke) {
      expect(stueck.bpm, stueck.id).toBeGreaterThan(40);
      expect(stueck.bpm, stueck.id).toBeLessThan(200);
    }
  });
});
