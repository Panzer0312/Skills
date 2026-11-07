import { queryClient } from "../../../../packages/web/src/app/queryClient.js";

export const SKILL = "guitar";
export const GAME_KEY = ["game", SKILL];
export const PROGRESS_KEY = ["progress", SKILL];
export const SONG_META_KEY = ["game", SKILL, "songs"];

export async function refreshing<T>(write: Promise<T>): Promise<T> {
  const result = await write;
  // Lesson statuses live in both views, and the library reads the progress one.
  await Promise.all([
    queryClient.invalidateQueries({ queryKey: GAME_KEY }),
    queryClient.invalidateQueries({ queryKey: PROGRESS_KEY }),
  ]);
  return result;
}

/** Like `refreshing`, but a refusal also refetches, so a stale view does not keep offering a failing action. */
export async function refreshingOnError<T>(write: Promise<T>): Promise<T> {
  try {
    return await refreshing(write);
  } catch (e) {
    await queryClient.invalidateQueries({ queryKey: GAME_KEY });
    throw e;
  }
}
