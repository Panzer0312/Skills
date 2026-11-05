import type { Rating } from "./progression.js";
import type { QuestDefinition } from "./quests.js";

export interface ScaledQuest {
  bpm: number | null;
  tempoPercent: number | null;
  chordPair: [string, string] | null;
  section: string | null;
  runs: number | null;
}

function lerp(range: [number, number], level: number): number {
  const t = (Math.min(10, Math.max(1, level)) - 1) / 9;
  return Math.round(range[0] + (range[1] - range[0]) * t);
}

export function scaleQuest(quest: QuestDefinition, level: number): ScaledQuest {
  const { bpm, tempoPercent, chordPairs, sections, runs } = quest.scale;
  const clamped = Math.min(10, Math.max(1, level));
  let chordPair: [string, string] | null = null;
  if (chordPairs && chordPairs.length > 0) {
    const index = Math.min(chordPairs.length - 1, Math.floor(((clamped - 1) / 10) * chordPairs.length));
    chordPair = chordPairs[index]!;
  }
  const section =
    sections && sections.length > 0 ? sections[Math.min(sections.length - 1, Math.floor(((clamped - 1) / 10) * sections.length))]! : null;
  return {
    bpm: bpm ? lerp(bpm, level) : null,
    tempoPercent: tempoPercent ? lerp(tempoPercent, level) : null,
    chordPair,
    section,
    runs: runs ? lerp(runs, level) : null,
  };
}

export function suggestLevel(ratings: { rating: Rating; level: number }[], current: number): number | null {
  const atLevel = ratings.filter((r) => r.level === current);
  const newest = atLevel[0];
  if (!newest) return null;
  if (newest.rating === "zu-schwer") return current > 1 ? current - 1 : null;
  const second = atLevel[1];
  if (newest.rating === "zu-leicht" && second?.rating === "zu-leicht") {
    return current < 10 ? current + 1 : null;
  }
  return null;
}

export function isMastered(
  entries: { rating: Rating | null; day: string; metricValue: number | null }[],
  target?: number,
): boolean {
  if (target !== undefined) return entries.some((e) => e.metricValue !== null && e.metricValue >= target);
  const days = new Set(
    entries.filter((e) => e.rating === "passt" || e.rating === "zu-leicht").map((e) => e.day),
  );
  return days.size >= 3;
}
