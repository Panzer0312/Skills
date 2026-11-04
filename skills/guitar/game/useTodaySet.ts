import { buildDailyQuests, type GameState } from "@skills/core";
import { useIsMutating, useMutation } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { gameApi, gameContent, todaysQuests } from "./api.js";

export const SESSION_LENGTHS = [10, 20, 30, 45];
const DEFAULT_MINUTES = 30;
const WRITE_KEY = ["game", "guitar", "today"];

interface TodayWrite {
  minutes: number;
  questIds: string[];
}

export interface FailedSave extends TodayWrite {
  message: string;
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
  const { mutateAsync } = useMutation({
    mutationKey: WRITE_KEY,
    networkMode: "always",
    mutationFn: ({ minutes: length, questIds }: TodayWrite) => gameApi.setToday(length, questIds),
  });
  // Shared across screens: a write the village started must stop the board from building again.
  const writing = useIsMutating({ mutationKey: WRITE_KEY }) > 0;

  async function save(length: number, questIds: string[]) {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFailed(null);
    try {
      await mutateAsync({ minutes: length, questIds });
    } catch (e) {
      const message = e instanceof Error ? e.message : "Speichern fehlgeschlagen.";
      setFailed({ message, minutes: length, questIds });
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  function build(length: number) {
    return save(
      length,
      buildDailyQuests({
        minutes: length,
        content: gameContent,
        statuses: state.lessons,
        hasTargetSong: state.targetSongId !== null,
        recentQuestIds: state.recentQuestIds,
      }),
    );
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

  return { quests, missing, minutes, saving, failed, save, build };
}
