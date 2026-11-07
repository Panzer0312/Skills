import { previousDay, weekStartKey } from "./time.js";

export type Rating = "zu-leicht" | "passt" | "zu-schwer";

export interface PracticeEntry {
  kind: "quest" | "frei";
  seconds: number;
  level: number;
  rating: Rating | null;
}

export function xpForEntry(entry: PracticeEntry): number {
  const level = entry.kind === "frei" ? 1 : entry.level;
  const base = Math.round((entry.seconds / 60) * 4 * (1 + (level - 1) * 0.1));
  const bonus = entry.kind === "quest" && entry.rating !== null && entry.seconds >= 30 ? 10 : 0;
  return base + bonus;
}

/** Gold comes only from logged practice: a fifth of the XP, rounded down. */
export function goldForEntry(entry: PracticeEntry): number {
  return Math.floor(xpForEntry(entry) / 5);
}

export function levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNext: number } {
  let level = 1;
  let rest = Math.max(0, xp);
  while (rest >= 100 * level) {
    rest -= 100 * level;
    level += 1;
  }
  return { level, xpIntoLevel: rest, xpForNext: 100 * level };
}

const TITLES = [
  "Wandering Novice",
  "Squire of the Strings",
  "Journeyman of the Frets",
  "Knight of the Riff",
  "Master of the Road",
  "Legend of the Six Strings",
];

export function titleForLevel(level: number): string {
  const index = Math.floor((Math.max(1, level) - 1) / 3);
  return TITLES[Math.min(index, TITLES.length - 1)]!;
}

/**
 * Counts practised days back from today. One missed day per calendar week
 * (Monday start) is forgiven if practice continues before it; forgiven days
 * add nothing. An unpractised today is still open and never breaks the streak.
 */
export function computeStreak(days: string[], today: string): number {
  const practised = new Set(days);
  if (practised.size === 0) return 0;
  const earliest = [...practised].sort()[0]!;
  let cursor = practised.has(today) ? today : previousDay(today);
  const forgivenWeeks = new Set<string>();
  let streak = 0;
  while (cursor >= earliest) {
    if (practised.has(cursor)) {
      streak += 1;
    } else {
      const week = weekStartKey(cursor);
      if (forgivenWeeks.has(week)) break;
      forgivenWeeks.add(week);
    }
    cursor = previousDay(cursor);
  }
  return streak;
}
