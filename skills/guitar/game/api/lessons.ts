import { api, ApiError } from "../../../../packages/web/src/api/client.js";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { GAME_KEY, refreshing, SKILL } from "./client.js";

export interface PlacementBody {
  knownLessonIds: string[];
  levels: Record<string, number>;
  targetSongId: string | null;
}

export const lessonsApi = {
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
};
