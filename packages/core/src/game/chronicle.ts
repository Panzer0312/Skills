import { previousDay, weekStartKey } from "./time.js";
import type { QuestDefinition } from "./quests.js";

export interface History {
  days: { day: string; seconds: number }[];
  /** Best value per key and day. */
  metrics: { key: string; day: string; value: number }[];
}

/** Minutes per calendar week, the current week last, weeks without play as 0. */
export function weeklyMinutes(
  days: History["days"],
  today: string,
  weeks = 12,
): { weekStart: string; minutes: number }[] {
  const starts: string[] = [];
  let start = weekStartKey(today);
  for (let i = 0; i < weeks; i++) {
    starts.unshift(start);
    start = weekStartKey(previousDay(start));
  }
  const seconds = new Map(starts.map((s) => [s, 0]));
  for (const { day, seconds: s } of days) {
    const key = weekStartKey(day);
    if (seconds.has(key)) seconds.set(key, seconds.get(key)! + s);
  }
  return starts.map((weekStart) => ({ weekStart, minutes: Math.round(seconds.get(weekStart)! / 60) }));
}

export type MetricGroup = "wechsel" | "bpm" | "noten" | "andere";

export function metricGroup(key: string, quests: QuestDefinition[]): MetricGroup {
  if (key.startsWith("wechsel:")) return "wechsel";
  if (key.startsWith("notenfinder:")) return "noten";
  const quest = quests.find((q) => q.id === key);
  if (quest && "noteGame" in quest && quest.noteGame) return "noten";
  if (quest?.metricLabel?.includes("BPM")) return "bpm";
  return "andere";
}

export function metricSeries(metrics: History["metrics"], key: string): { day: string; value: number }[] {
  return metrics
    .filter((m) => m.key === key)
    .map(({ day, value }) => ({ day, value }))
    .sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0));
}
