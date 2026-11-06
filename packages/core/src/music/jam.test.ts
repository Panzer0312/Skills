import { describe, expect, it } from "vitest";
import { NOTES } from "./notes.js";
import { JAM_STYLES, jamBar, jamChord, type JamStyle } from "./jam.js";

const STYLES: JamStyle[] = ["rock", "metal", "blues"];
const ROOTS = [...NOTES];
const chords = (style: JamStyle, root: string, n: number) =>
  Array.from({ length: n }, (_, i) => jamChord({ root, style }, i));

describe("jam chords", () => {
  it("rock uses minor on the tonic and major elsewhere", () => {
    expect(chords("rock", "A", 4)).toEqual(["Am", "F", "C", "G"]);
  });

  it("metal uses power chords", () => {
    expect(chords("metal", "E", 4)).toEqual(["E5", "E5", "C5", "D5"]);
  });

  it("blues uses dominant sevens", () => {
    expect(chords("blues", "A", 12)).toEqual([
      "A7", "A7", "A7", "A7", "D7", "D7", "A7", "A7", "E7", "D7", "A7", "A7",
    ]);
  });

  it("repeats the progression", () => {
    expect(jamChord({ root: "A", style: "rock" }, 4)).toBe("Am");
  });
});

describe("JAM_STYLES", () => {
  it("names the scale and step grid per style", () => {
    expect(JAM_STYLES.metal.scale).toBe("moll");
    expect(JAM_STYLES.blues.stepsPerBar).toBe(12);
  });
});

describe("jamBar", () => {
  for (const style of STYLES) {
    for (const root of ROOTS) {
      describe(`${style} in ${root}`, () => {
        const settings = { root, style };
        const { stepsPerBar } = JAM_STYLES[style];
        const bars = Array.from({ length: 12 }, (_, i) => i);

        it("keeps every step inside the bar", () => {
          for (const bar of bars) {
            for (const hit of jamBar(settings, bar)) {
              expect(hit.step).toBeGreaterThanOrEqual(0);
              expect(hit.step).toBeLessThan(stepsPerBar);
            }
          }
        });

        it("starts every bar with a kick and a bass hit", () => {
          for (const bar of bars) {
            const hits = jamBar(settings, bar);
            expect(hits.some((h) => h.step === 0 && h.voice === "kick")).toBe(true);
            expect(hits.some((h) => h.step === 0 && h.voice === "bass")).toBe(true);
          }
        });

        it("puts the snare on beats 2 and 4", () => {
          const beat = stepsPerBar / 4;
          for (const bar of bars) {
            const snares = jamBar(settings, bar)
              .filter((h) => h.voice === "snare")
              .map((h) => h.step);
            expect(snares).toContain(beat);
            expect(snares).toContain(beat * 3);
          }
        });

        it("keeps bass notes in range", () => {
          for (const bar of bars) {
            for (const hit of jamBar(settings, bar)) {
              if (hit.voice === "bass") {
                expect(hit.midi).toBeGreaterThanOrEqual(28);
                expect(hit.midi).toBeLessThanOrEqual(39);
              }
            }
          }
        });

        it("plays the chord's pitch class on the bass at step 0", () => {
          for (const bar of bars) {
            const chord = jamChord(settings, bar);
            const pc = NOTES.indexOf(chord.replace(/(m|5|7)$/, "") as (typeof NOTES)[number]);
            const bass = jamBar(settings, bar).find((h) => h.voice === "bass" && h.step === 0);
            expect(bass?.midi! % 12).toBe(pc);
          }
        });
      });
    }
  }

  it("keeps blues hats on shuffle steps only", () => {
    for (const root of ROOTS) {
      for (let bar = 0; bar < 12; bar++) {
        for (const hit of jamBar({ root, style: "blues" }, bar)) {
          if (hit.voice === "hat") expect(hit.step % 3).not.toBe(1);
        }
      }
    }
  });

  it("gives metal at least 8 gallop bass hits per bar", () => {
    for (const root of ROOTS) {
      for (let bar = 0; bar < 12; bar++) {
        const bassHits = jamBar({ root, style: "metal" }, bar).filter((h) => h.voice === "bass");
        expect(bassHits.length).toBeGreaterThanOrEqual(8);
      }
    }
  });
});
