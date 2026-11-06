import type { Rating } from "./progression.js";
import type { LessonStatus } from "./quests.js";

export interface GameState {
  /** The server's local day key, which a set written now is stored under. */
  day: string;
  placed: boolean;
  targetSongId: string | null;
  xp: number;
  level: number;
  title: string;
  xpIntoLevel: number;
  xpForNext: number;
  streak: number;
  totalSeconds: number;
  weekSeconds: number;
  doneToday: string[];
  levels: Record<string, number>;
  lessons: Record<string, LessonStatus>;
  chosenLessons: string[];
  records: Record<string, number>;
  recentQuestIds: string[];
  today: { minutes: number; questIds: string[] } | null;
}

export interface LogBody {
  kind: "quest" | "frei";
  questId?: string;
  lessonId?: string;
  techniqueId?: string;
  seconds: number;
  level: number;
  rating?: Rating;
  metricKey?: string;
  metricValue?: number;
  masteryTarget?: number;
  quick?: boolean;
}
