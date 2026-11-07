import { useMutation, type UseMutationResult } from "@tanstack/react-query";
import { api } from "../../../../packages/web/src/api/client.js";
import { refreshingOnError, SKILL } from "./client.js";

export function useSoundSetting(): UseMutationResult<{ ok: true }, Error, boolean> {
  return useMutation({
    mutationFn: (sound: boolean) => refreshingOnError(api.put<{ ok: true }>(`/api/game/${SKILL}/settings`, { sound })),
  });
}
