import { z } from "zod";
import { defaultAccents, SUBDIVISIONS, type Subdivision } from "../../audio/click.js";
import { JAM_STYLES, type JamStyle } from "../../music/jam.js";
import { NOTES, TUNINGS } from "../../music/notes.js";
import { definePrefs } from "./define.js";

const hidden = { kind: "hidden" } as const;

export interface StoredMetronome {
  beatsPerBar: number;
  subdivision: Subdivision;
  accents: boolean[];
  stepBpm: number;
  everyBars: number;
}

export interface StoredJam {
  root: string;
  style: JamStyle;
  bpm: number;
  box?: 1 | 2 | 3 | 4 | 5;
  volume: number;
}

const metronome: z.ZodType<StoredMetronome> = z.custom<StoredMetronome>((raw) => {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.beatsPerBar === "number" &&
    [2, 3, 4, 5, 6, 7].includes(r.beatsPerBar) &&
    typeof r.subdivision === "string" &&
    r.subdivision in SUBDIVISIONS &&
    Array.isArray(r.accents) &&
    r.accents.every((a) => typeof a === "boolean") &&
    typeof r.stepBpm === "number" &&
    r.stepBpm >= 1 &&
    r.stepBpm <= 50 &&
    typeof r.everyBars === "number" &&
    r.everyBars >= 1 &&
    r.everyBars <= 32
  );
}, "Ungültige Metronom-Einstellung");

const jam: z.ZodType<StoredJam> = z.custom<StoredJam>((raw) => {
  if (typeof raw !== "object" || raw === null) return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.root === "string" &&
    (NOTES as readonly string[]).includes(r.root) &&
    typeof r.style === "string" &&
    r.style in JAM_STYLES &&
    typeof r.bpm === "number" &&
    r.bpm >= 50 &&
    r.bpm <= 220 &&
    (r.box === undefined || [1, 2, 3, 4, 5].includes(r.box as number)) &&
    typeof r.volume === "number" &&
    r.volume >= 0 &&
    r.volume <= 1
  );
}, "Ungültige Jam-Einstellung");

const tuningName = z.string().refine((n) => TUNINGS.some((t) => t.name === n), "Unbekannte Stimmung");

export const prefs = definePrefs({
  "werkzeuge.metronom": {
    schema: metronome,
    default: {
      beatsPerBar: 4,
      subdivision: "viertel",
      accents: defaultAccents(4),
      stepBpm: 4,
      everyBars: 2,
    } as StoredMetronome,
    label: "Metronom",
    group: "werkzeuge",
    ui: hidden,
  },
  "werkzeuge.jam": {
    schema: jam,
    default: { root: "E", style: "rock", bpm: 90, volume: 0.7 } as StoredJam,
    label: "Jam Room",
    group: "werkzeuge",
    ui: hidden,
  },
  "werkzeuge.stimmgeraet.stimmung": {
    schema: tuningName,
    default: "Standard",
    label: "Stimmung im Stimmgerät",
    group: "werkzeuge",
    ui: hidden,
  },
  "werkzeuge.notenfinder.stimmung": {
    schema: tuningName,
    default: "Standard",
    label: "Stimmung im Notenfinder",
    group: "werkzeuge",
    ui: hidden,
  },
  "werkzeuge.akkordtrainer.eigenesPaar": {
    schema: z.tuple([z.string(), z.string()]),
    default: ["C", "G"] as [string, string],
    label: "Eigenes Akkordpaar",
    group: "werkzeuge",
    ui: hidden,
  },
});
