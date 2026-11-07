import { displayNote, TUNINGS, type Tuning } from "@skills/core";

export function findTuning(name: string): Tuning | undefined {
  return TUNINGS.find((t) => t.name === name);
}

/** Label of a string: the open note without its octave, the high string in lower case. */
export function stringLabel(tuning: Tuning, index: number): string {
  const name = displayNote(tuning.strings[index]!.replace(/-?\d+$/, ""));
  return index === 5 ? name.toLowerCase() : name;
}

/** The strings of a note finder round in German, e.g. "E-Saite", "E und A" or "Alle". */
export function stringsLabel(tuning: Tuning, strings: number[]): string {
  if (strings.length === 6) return "Alle";
  const names = strings.map((s) => stringLabel(tuning, s));
  if (names.length === 1) return `${names[0]}-Saite`;
  return `${names.slice(0, -1).join(", ")} und ${names.at(-1)}`;
}

/**
 * Label of a note finder metric key: `notenfinder:<strings>` for Standard,
 * `notenfinder:<tuning>:<strings>` for any other tuning.
 */
export function noteRoundLabel(key: string): string {
  const rest = key.slice("notenfinder:".length);
  const split = rest.lastIndexOf(":");
  const tuningName = split >= 0 ? rest.slice(0, split) : "Standard";
  const tuning = findTuning(tuningName);
  const part = split >= 0 ? rest.slice(split + 1) : rest;
  const strings = part.split("-").map(Number);
  const valid = /^[0-5](-[0-5])*$/.test(part) && new Set(strings).size === strings.length;
  const label = tuning && valid ? stringsLabel(tuning, strings) : "Eigene Saiten";
  return split >= 0 ? `${tuningName}, ${label}` : label;
}
