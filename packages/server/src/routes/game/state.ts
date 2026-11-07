import { Hono } from "hono";
import {
  computeStreak,
  gearItem,
  levelFromXp,
  localDayKey,
  previousDay,
  titleForLevel,
  weekStartKey,
  xpForEntry,
  type GameState,
  type GearSlot,
  type History,
  type LessonStatus,
} from "@skills/core";
import type { AppEnv } from "../../app.js";
import { STATUS_READ, wallet, type LogRow } from "./shared.js";

export const router = new Hono<AppEnv>();

router.get("/api/game/:skillId/state", (c) => {
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const today = localDayKey(Date.now());
  const rows = raw
    .prepare(
      "SELECT day, kind, quest_id, seconds, level, rating, metric_key, metric_value FROM game_log WHERE skill_id = ?",
    )
    .all(skillId) as LogRow[];

  const xp = rows.reduce(
    (sum, r) => sum + xpForEntry({ kind: r.kind, seconds: r.seconds, level: r.level, rating: r.rating }),
    0,
  );
  const weekStart = weekStartKey(today);
  const yesterday = previousDay(today);
  const records: Record<string, number> = {};
  for (const r of rows) {
    if (r.metric_key !== null && r.metric_value !== null) {
      records[r.metric_key] = Math.max(records[r.metric_key] ?? -Infinity, r.metric_value);
    }
  }

  const levels: Record<string, number> = {};
  for (const r of raw
    .prepare("SELECT technique_id, level FROM game_levels WHERE skill_id = ?")
    .all(skillId) as { technique_id: string; level: number }[]) {
    levels[r.technique_id] = r.level;
  }
  const lessons: Record<string, LessonStatus> = {};
  for (const r of raw
    .prepare("SELECT lesson_id, status FROM lesson_progress WHERE skill_id = ?")
    .all(skillId) as { lesson_id: string; status: string }[]) {
    lessons[r.lesson_id] = STATUS_READ[r.status] ?? "offen";
  }
  const chosenLessons = (
    raw
      .prepare("SELECT lesson_id FROM game_chosen WHERE skill_id = ? ORDER BY chosen_at, rowid")
      .all(skillId) as { lesson_id: string }[]
  )
    .map((r) => r.lesson_id)
    .filter((id) => lessons[id] !== "gelernt" && lessons[id] !== "gemeistert");
  const profile = raw
    .prepare("SELECT placed_at, target_song_id FROM game_profile WHERE skill_id = ?")
    .get(skillId) as { placed_at: number | null; target_song_id: string | null } | undefined;
  const todayRow = raw
    .prepare("SELECT minutes, quest_ids_json FROM game_today WHERE skill_id = ? AND day = ?")
    .get(skillId, today) as { minutes: number; quest_ids_json: string } | undefined;

  const storySeen = (
    raw
      .prepare("SELECT beat_id FROM game_story_seen WHERE skill_id = ? ORDER BY seen_at, rowid")
      .all(skillId) as { beat_id: string }[]
  ).map((r) => r.beat_id);

  const questDays: Record<string, string> = {};
  for (const r of rows) {
    if (r.quest_id !== null && r.day > (questDays[r.quest_id] ?? "")) questDays[r.quest_id] = r.day;
  }
  const questIdsOn = (day: string) => [
    ...new Set(rows.filter((r) => r.day === day && r.quest_id !== null).map((r) => r.quest_id!)),
  ];
  const { gold, owned } = wallet(raw, skillId);
  const equipped: Partial<Record<GearSlot, string>> = {};
  for (const r of raw
    .prepare("SELECT slot, item_id FROM game_equipped WHERE skill_id = ?")
    .all(skillId) as { slot: string; item_id: string }[]) {
    const item = gearItem(r.item_id);
    if (item && item.slot === r.slot && owned.includes(item.id)) equipped[item.slot] = item.id;
  }
  const soundRow = raw.prepare("SELECT sound FROM game_settings WHERE skill_id = ?").get(skillId) as
    | { sound: number }
    | undefined;
  const soundPref = raw
    .prepare("SELECT value_json FROM game_prefs WHERE skill_id = ? AND key = 'klang.an'")
    .get(skillId) as { value_json: string } | undefined;
  const sound = soundPref ? soundPref.value_json === "true" : soundRow?.sound === 1;
  const state: GameState = {
    day: today,
    placed: profile?.placed_at != null,
    targetSongId: profile?.target_song_id ?? null,
    xp,
    ...levelFromXp(xp),
    title: titleForLevel(levelFromXp(xp).level),
    streak: computeStreak([...new Set(rows.map((r) => r.day))], today),
    totalSeconds: rows.reduce((s, r) => s + r.seconds, 0),
    weekSeconds: rows.filter((r) => r.day >= weekStart).reduce((s, r) => s + r.seconds, 0),
    doneToday: questIdsOn(today),
    levels,
    lessons,
    chosenLessons,
    records,
    recentQuestIds: questIdsOn(yesterday),
    questDays,
    storySeen,
    today: todayRow
      ? { minutes: todayRow.minutes, questIds: JSON.parse(todayRow.quest_ids_json) as string[] }
      : null,
    gold,
    owned,
    equipped,
    sound,
  };
  return c.json(state);
});

router.get("/api/game/:skillId/history", (c) => {
  const raw = c.get("database").raw;
  const skillId = c.req.param("skillId");
  const days = raw
    .prepare("SELECT day, SUM(seconds) AS seconds FROM game_log WHERE skill_id = ? GROUP BY day ORDER BY day")
    .all(skillId) as History["days"];
  const metrics = raw
    .prepare(
      `SELECT metric_key AS key, day, MAX(metric_value) AS value FROM game_log
       WHERE skill_id = ? AND metric_key IS NOT NULL AND metric_value IS NOT NULL
       GROUP BY metric_key, day ORDER BY day, metric_key`,
    )
    .all(skillId) as History["metrics"];
  const history: History = { days, metrics };
  return c.json(history);
});
