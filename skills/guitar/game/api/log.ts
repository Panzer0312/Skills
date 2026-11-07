import type { LogBody, LogResult } from "@skills/core";
import { api } from "../../../../packages/web/src/api/client.js";
import { refreshing, SKILL } from "./client.js";

export type { LogResult };

export const logApi = {
  // The GAME_KEY prefix also invalidates the history and recent views.
  deleteLog: (id: number) => refreshing(api.del<{ ok: true; goldForgiven: number }>(`/api/game/${SKILL}/log/${id}`)),
  exportUrl: `/api/game/${SKILL}/export`,
  log: (body: LogBody) => refreshing(api.post<LogResult>(`/api/game/${SKILL}/log`, body)),
};
