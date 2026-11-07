import type { GearSlot } from "./gear.js";
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
  /** Quest id to the last local day it was logged. */
  questDays: Record<string, string>;
  /** Story beats the player has acknowledged. */
  storySeen: string[];
  today: { minutes: number; questIds: string[] } | null;
  /** Gold earned from practice minus gold spent. */
  gold: number;
  /** Purchased items plus milestone items whose lesson is done. */
  owned: string[];
  equipped: Partial<Record<GearSlot, string>>;
  sound: boolean;
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

export interface SongMeta {
  stars: number;
  lastPlayedAt: number | null;
  tags: string[];
}

export interface SongMetaPatch {
  stars?: number;
  tags?: string[];
  played?: true;
}
