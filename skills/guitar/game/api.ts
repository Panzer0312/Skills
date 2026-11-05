import {
  parseGameContent,
  type GameContent,
  type GameState,
  type LogBody,
  type QuestDefinition,
} from "@skills/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../../../packages/web/src/api/client.js";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import map from "./map.json";
import quests from "./quests.json";
import road from "./road.json";

const SKILL = "guitar";
const GAME_KEY = ["game", SKILL];
const PROGRESS_KEY = ["progress", SKILL];

export const GAME_BASE = "/vollbild/guitar/spiel";

export const DEFAULT_LEVEL = 3;

export const gameContent: GameContent = parseGameContent({ ...quests, road, ...map });

export function questLevel(state: GameState, quest: QuestDefinition): number {
  return state.levels[quest.techniqueId] ?? DEFAULT_LEVEL;
}

/** Today's saved quests that still exist in the content. */
export function todaysQuests(state: GameState): QuestDefinition[] {
  const ids = state.today?.questIds ?? [];
  return ids.flatMap((id) => gameContent.quests.find((quest) => quest.id === id) ?? []);
}

export function useGameState(): UseQueryResult<GameState> {
  return useQuery({
    queryKey: GAME_KEY,
    queryFn: () => api.get<GameState>(`/api/game/${SKILL}/state`),
    refetchOnWindowFocus: "always",
  });
}

async function refreshing<T>(write: Promise<T>): Promise<T> {
  const result = await write;
  // Lesson statuses live in both views, and the library reads the progress one.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: GAME_KEY }),
    queryClient.invalidateQueries({ queryKey: PROGRESS_KEY }),
  ]);
  return result;
}

export interface LogResult {
  xpGained: number;
  suggestion: number | null;
  isRecord: boolean;
}

export interface PlacementBody {
  knownLessonIds: string[];
  levels: Record<string, number>;
  targetSongId: string | null;
}

export const gameApi = {
  log: (body: LogBody) => refreshing(api.post<LogResult>(`/api/game/${SKILL}/log`, body)),
  setLevel: (techniqueId: string, level: number) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/level/${techniqueId}`, { level })),
  setToday: (minutes: number, questIds: string[]) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/today`, { minutes, questIds })),
  placement: (body: PlacementBody) =>
    refreshing(api.post<{ ok: true }>(`/api/game/${SKILL}/placement`, body)),
};
