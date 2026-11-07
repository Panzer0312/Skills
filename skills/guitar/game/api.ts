import {
  parseGameContent,
  parseStory,
  type GameContent,
  type GameState,
  type GearSlot,
  type History,
  type LessonStatus,
  type LogBody,
  type LogResult,
  type QuestDefinition,
  type RecentLogEntry,
  type SongMeta,
  type SongMetaPatch,
  type Story,
} from "@skills/core";
import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from "@tanstack/react-query";
import { api, ApiError } from "../../../packages/web/src/api/client.js";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import map from "./map.json";
import quests from "./quests.json";
import riffs from "./riffs.json";
import road from "./road.json";
import storyData from "./story.json";

const SKILL = "guitar";
const GAME_KEY = ["game", SKILL];
const PROGRESS_KEY = ["progress", SKILL];
export const SONG_META_KEY = ["game", SKILL, "songs"];

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

export function useGameState(): UseQueryResult<GameState> {
  return useQuery({
    queryKey: GAME_KEY,
    queryFn: () => api.get<GameState>(`/api/game/${SKILL}/state`),
    refetchOnWindowFocus: "always",
  });
}

export function useGameHistory(): UseQueryResult<History> {
  return useQuery({
    queryKey: [...GAME_KEY, "history"],
    queryFn: gameApi.history,
    retry: false,
    refetchOnWindowFocus: "always",
  });
}

export function useRecentLog(): UseQueryResult<{ entries: RecentLogEntry[] }> {
  return useQuery({
    queryKey: [...GAME_KEY, "recent"],
    queryFn: gameApi.recentLog,
    retry: false,
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

export type { LogResult };

export interface PlacementBody {
  knownLessonIds: string[];
  levels: Record<string, number>;
  targetSongId: string | null;
}

/** Like `refreshing`, but a refusal also refetches, so a stale view does not keep offering a failing action. */
async function refreshingOnError<T>(write: Promise<T>): Promise<T> {
  try {
    return await refreshing(write);
  } catch (e) {
    await queryClient.invalidateQueries({ queryKey: GAME_KEY });
    throw e;
  }
}

export const gameApi = {
  history: () => api.get<History>(`/api/game/${SKILL}/history`),
  recentLog: () => api.get<{ entries: RecentLogEntry[] }>(`/api/game/${SKILL}/log/recent`),
  // The GAME_KEY prefix also invalidates the history and recent views.
  deleteLog: (id: number) => refreshing(api.del<{ ok: true }>(`/api/game/${SKILL}/log/${id}`)),
  exportUrl: `/api/game/${SKILL}/export`,
  log: (body: LogBody) => refreshing(api.post<LogResult>(`/api/game/${SKILL}/log`, body)),
  setLevel: (techniqueId: string, level: number) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/level/${techniqueId}`, { level })),
  setToday: (minutes: number, questIds: string[]) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/today`, { minutes, questIds })),
  placement: (body: PlacementBody) =>
    refreshing(api.post<{ ok: true }>(`/api/game/${SKILL}/placement`, body)),
  /**
   * Rejects with an ApiError of code `limit` when two lessons are chosen and `replace` is missing.
   * `mainRoad` names the lesson on the gold road, which takes no slot.
   * The state is fresh by then, so whoever asks which lesson to pause lists the real ones.
   */
  chooseLesson: async (id: string, replace?: string, mainRoad?: string) => {
    try {
      return await refreshing(
        api.put<{ ok: true }>(`/api/game/${SKILL}/chosen/${id}`, {
          ...(replace ? { replace } : {}),
          ...(mainRoad ? { mainRoad } : {}),
        }),
      );
    } catch (e) {
      if (e instanceof ApiError && e.code === "limit") await queryClient.invalidateQueries({ queryKey: GAME_KEY });
      throw e;
    }
  },
  pauseLesson: (id: string) => refreshing(api.del<{ ok: true }>(`/api/game/${SKILL}/chosen/${id}`)),
  songMeta: () => api.get<{ songs: Record<string, SongMeta> }>(`/api/game/${SKILL}/songs`),
  setSongMeta: async (songKey: string, patch: SongMetaPatch) => {
    const result = await api.put<{ ok: true }>(`/api/game/${SKILL}/song/${encodeURIComponent(songKey)}`, patch);
    await queryClient.invalidateQueries({ queryKey: SONG_META_KEY });
    return result;
  },
  markStorySeen: (beatIds: string[]) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/story/seen`, { beatIds })),
  setTargetSong: (targetSongId: string | null) =>
    refreshing(api.put<{ ok: true }>(`/api/game/${SKILL}/target-song`, { targetSongId })),
};

/** The buy route answers a refusal as `{ error: "<German text>", reason }`, which the shared client does not unwrap. */
async function postBuy(itemId: string): Promise<{ gold: number }> {
  let response: Response;
  try {
    response = await fetch(`/api/game/${SKILL}/market/buy`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
  } catch {
    throw new ApiError("offline", "Der Server ist nicht erreichbar. Läuft er noch?");
  }
  const body = (await response.json().catch(() => null)) as {
    gold?: number;
    error?: string | { code?: string; message?: string };
    reason?: string;
  } | null;
  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : body?.error?.message;
    throw new ApiError(body?.reason ?? "unknown", message ?? `Anfrage fehlgeschlagen (${response.status}).`);
  }
  return { gold: body?.gold ?? 0 };
}

/** Buys one Market item. Rejects with the server's German refusal as the error message. */
export function useBuyItem(): UseMutationResult<{ gold: number }, Error, string> {
  return useMutation({
    mutationFn: (itemId: string) => refreshingOnError(postBuy(itemId)),
  });
}

/** Equips an owned item into its slot, or empties the slot with `itemId: null`. */
export function useEquip(): UseMutationResult<{ ok: true }, Error, { slot: GearSlot; itemId: string | null }> {
  return useMutation({
    mutationFn: (body: { slot: GearSlot; itemId: string | null }) =>
      refreshingOnError(api.put<{ ok: true }>(`/api/game/${SKILL}/equip`, body)),
  });
}

export function useSoundSetting(): UseMutationResult<{ ok: true }, Error, boolean> {
  return useMutation({
    mutationFn: (sound: boolean) => refreshingOnError(api.put<{ ok: true }>(`/api/game/${SKILL}/settings`, { sound })),
  });
}
