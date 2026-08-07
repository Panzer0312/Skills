import { chordShape, parseChordFile, type ChordShape } from "@skills/core";
import type { ChordOverrides } from "./chordOverrides.js";

export interface ResolveUserChordsResult {
  chords: Record<string, ChordShape>;
  warnings: string[];
}

function unwrap(mod: unknown): unknown {
  if (mod && typeof mod === "object" && "default" in mod) {
    return (mod as { default: unknown }).default;
  }
  return mod;
}

/**
 * Merges every `chords/*.json` file a skill ships into a single symbol -> shape map.
 * An invalid file is skipped (with a warning) rather than crashing the app — the same
 * failure philosophy as an invalid manifest (see `packages/web/src/skills/registry.ts`).
 */
export function resolveUserChords(modules: Record<string, unknown>): ResolveUserChordsResult {
  const chords: Record<string, ChordShape> = {};
  const warnings: string[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const parsed = parseChordFile(unwrap(mod), path);
    if (!parsed.ok) {
      warnings.push(`Akkord-Datei "${path}" wurde übersprungen: ${parsed.error}`);
      continue;
    }
    for (const entry of parsed.entries) {
      chords[entry.symbol] = {
        name: entry.name ?? entry.symbol,
        frets: entry.frets,
        fingers: entry.fingers,
        baseFret: entry.baseFret,
      };
    }
  }

  return { chords, warnings };
}

const chordGlob = import.meta.glob("../../../../skills/*/chords/*.json", { eager: true });

let cached: Record<string, ChordShape> | null = null;

function userChords(): Record<string, ChordShape> {
  if (!cached) {
    const { chords, warnings } = resolveUserChords(chordGlob);
    for (const warning of warnings) console.warn(warning);
    cached = chords;
  }
  return cached;
}

/**
 * Resolves a chord symbol to a diagram shape with the documented precedence:
 * song override, global override, user-supplied JSON, the open-chord table,
 * a derived movable barre shape, or `null` when none of those apply
 * (see `docs/skills-authoring.md`).
 */
export function resolveChordShape(symbol: string, overrides?: ChordOverrides): ChordShape | null {
  return (
    overrides?.song?.[symbol] ??
    overrides?.global?.[symbol] ??
    userChords()[symbol] ??
    chordShape(symbol) ??
    null
  );
}
