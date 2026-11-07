import type { SongMeta, SongMetaPatch } from "@skills/core";
import { api } from "../../../../packages/web/src/api/client.js";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { refreshing, SKILL, SONG_META_KEY } from "./client.js";

export const songsApi = {
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
