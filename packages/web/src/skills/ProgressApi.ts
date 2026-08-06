import { api } from "../api/client.js";

export type PracticeResult = "correct" | "wrong";

export interface ProgressApi {
  record(itemId: string, result: PracticeResult): void;
  get(itemId: string): PracticeResult | null;
  complete(moduleId: string): Promise<void>;
}

function storageKey(skillId: string): string {
  return `skills.progress.${skillId}`;
}

function readAll(skillId: string): Record<string, PracticeResult> {
  const raw = localStorage.getItem(storageKey(skillId));
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, PracticeResult>;
  } catch {
    return {};
  }
}

export function createProgressApi(skillId: string): ProgressApi {
  return {
    record(itemId, result) {
      const all = readAll(skillId);
      all[itemId] = result;
      localStorage.setItem(storageKey(skillId), JSON.stringify(all));
    },
    get(itemId) {
      return readAll(skillId)[itemId] ?? null;
    },
    async complete(moduleId) {
      await api.put(`/api/progress/${skillId}/${moduleId}`, { status: "done", checkpoint: {} });
    },
  };
}
