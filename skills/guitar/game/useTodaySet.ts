import { buildDailyQuests, localDayKey, type GameState } from "@skills/core";
import { useIsMutating, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { gameApi, gameContent, todaysQuests } from "./api.js";

export const SESSION_LENGTHS = [10, 20, 30, 45];
export const DEFAULT_MINUTES = 30;
const WRITE_KEY = ["game", "guitar", "today"];

interface TodayWrite {
  minutes: number;
  questIds: string[];
}

export interface FailedSave extends TodayWrite {
  message: string;
}

/** The set the current state yields, which is also what a new day starts from. */
export function plannedSet(state: GameState, minutes: number, recentQuestIds: string[]): string[] {
  return buildDailyQuests({
    minutes,
    content: gameContent,
    statuses: state.lessons,
    hasTargetSong: state.targetSongId !== null,
    recentQuestIds,
    questDays: state.questDays,
    chosenLessonIds: state.chosenLessons,
  });
}

/** Today's set for the village and the board, built by whichever the owner opens first. */
export function useTodaySet(state: GameState, fetching: boolean) {
  const quests = todaysQuests(state);
  const missing = quests.length === 0;
  const minutes =
    state.today && SESSION_LENGTHS.includes(state.today.minutes) ? state.today.minutes : DEFAULT_MINUTES;
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState<FailedSave | null>(null);
  const savingRef = useRef(false);
  const built = useRef(false);
  // The server day already refetched for, so a lasting mismatch (another timezone) refetches only once.
  const refetchedFor = useRef<string | null>(null);
  const queryClient = useQueryClient();
  const { mutateAsync } = useMutation({
    mutationKey: WRITE_KEY,
    networkMode: "always",
    mutationFn: ({ minutes: length, questIds }: TodayWrite) => gameApi.setToday(length, questIds),
  });
  // Shared across screens: a write the village started must stop the board from building again.
  const writing = useIsMutating({ mutationKey: WRITE_KEY }) > 0;

  /** Whether the set was written. */
  async function save(length: number, questIds: string[]): Promise<boolean> {
    // Past midnight the ids were built on yesterday's state, so let the fresh state rebuild them.
    // If the fresh state keeps the same day, the server's day wins and the write goes through.
    if (state.day !== localDayKey(Date.now()) && state.day !== refetchedFor.current) {
      refetchedFor.current = state.day;
      void queryClient.invalidateQueries({ queryKey: ["game", "guitar"] });
      // The fresh state may still lack a set, and then the auto-build has to run again.
      built.current = false;
      return false;
    }
    if (savingRef.current) return false;
    savingRef.current = true;
    setSaving(true);
    setFailed(null);
    try {
      await mutateAsync({ minutes: length, questIds });
      return true;
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      setFailed({ message, minutes: length, questIds });
      return false;
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function build(length: number) {
    return save(length, plannedSet(state, length, state.recentQuestIds));
  }

  useEffect(() => {
    if (!missing) {
      // The next day finds the set missing again.
      built.current = false;
      return;
    }
    // A cached state may be from yesterday, so only a finished fetch can decide.
    if (fetching || writing || built.current) return;
    built.current = true;
    void build(minutes);
  });

  return { quests, missing, minutes, saving, writing, failed, save, build };
}
