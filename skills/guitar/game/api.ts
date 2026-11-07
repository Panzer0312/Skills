import {
  parseGameContent,
  parseStory,
  type GameContent,
  type GameState,
  type LessonStatus,
  type QuestDefinition,
  type Story,
} from "@skills/core";
import map from "./map.json";
import quests from "./quests.json";
import riffs from "./riffs.json";
import road from "./road.json";
import storyData from "./story.json";
import { lessonsApi } from "./api/lessons.js";
import { logApi } from "./api/log.js";
import { songsApi } from "./api/songs.js";
import { stateApi } from "./api/state.js";

export { SONG_META_KEY } from "./api/client.js";
export { useGameHistory, useGameState, useRecentLog } from "./api/state.js";
export type { LogResult } from "./api/log.js";
export type { PlacementBody } from "./api/lessons.js";
export { useBuyItem, useEquip } from "./api/market.js";
export { useSoundSetting } from "./api/settings.js";

export const gameApi = {
  ...stateApi,
  ...logApi,
  ...lessonsApi,
  ...songsApi,
};

export const GAME_BASE = "/vollbild/guitar/spiel";

export const DEFAULT_LEVEL = 3;

export const gameContent: GameContent = parseGameContent({ ...quests, road, ...map, riffs });

export const story: Story = parseStory(storyData, gameContent);

export const isDone = (status: LessonStatus | undefined) => status === "gelernt" || status === "gemeistert";

/** Song titles as compared across the map content and imported songs, without a suffix like " (Chords)". */
export function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[’‘ʼ´`]/g, "'")
    .replace(/\s*\([^()]*\)\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function questLevel(state: GameState, quest: QuestDefinition): number {
  return state.levels[quest.techniqueId] ?? DEFAULT_LEVEL;
}

/** Today's saved quests that still exist in the content. */
export function todaysQuests(state: GameState): QuestDefinition[] {
  const ids = state.today?.questIds ?? [];
  return ids.flatMap((id) => gameContent.quests.find((quest) => quest.id === id) ?? []);
}
