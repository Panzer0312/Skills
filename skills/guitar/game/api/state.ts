import type { GameState, History, RecentLogEntry } from "@skills/core";
import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { api } from "../../../../packages/web/src/api/client.js";
import { GAME_KEY, SKILL } from "./client.js";

export const stateApi = {
  history: () => api.get<History>(`/api/game/${SKILL}/history`),
  recentLog: (since?: number) =>
    api.get<{ entries: RecentLogEntry[] }>(
      `/api/game/${SKILL}/log/recent${since === undefined ? "" : `?since=${Math.floor(since)}`}`,
    ),
};

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
    queryFn: stateApi.history,
    retry: false,
    refetchOnWindowFocus: "always",
  });
}

export function useRecentLog(): UseQueryResult<{ entries: RecentLogEntry[] }> {
  return useQuery({
    queryKey: [...GAME_KEY, "recent"],
    queryFn: () => stateApi.recentLog(),
    retry: false,
    refetchOnWindowFocus: "always",
  });
}
