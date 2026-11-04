import { Hono } from "hono";
import { localDayKey } from "@skills/core";
import type { AppEnv } from "../app.js";

const DAY = 86_400_000;

function startOfLocalDay(ts: number): number {
  const d = new Date(ts);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

export const statsRoutes = new Hono<AppEnv>();

statsRoutes.get("/api/stats", (c) => {
  const { raw } = c.get("database");
  const now = Date.now();
  const today = startOfLocalDay(now);

  const reviewRows = raw
    .prepare("SELECT reviewed_at AS reviewedAt, rating, state_before AS stateBefore FROM reviews WHERE reviewed_at >= ?")
    .all(today - 364 * DAY) as { reviewedAt: number; rating: number; stateBefore: string }[];

  const counts = new Map<string, number>();
  for (const row of reviewRows) {
    const key = localDayKey(row.reviewedAt);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const heatmap = Array.from({ length: 365 }, (_, i) => {
    const ts = today - (364 - i) * DAY;
    const key = localDayKey(ts);
    return { day: key, count: counts.get(key) ?? 0 };
  });

  const reviewStateRows = reviewRows.filter((row) => row.stateBefore === "review");
  const retention =
    reviewStateRows.length === 0
      ? 0
      : reviewStateRows.filter((row) => row.rating >= 2).length / reviewStateRows.length;

  const stateRows = raw
    .prepare(
      `SELECT s.state AS state, COUNT(*) AS count
       FROM scheduling s JOIN cards c ON c.id = s.card_id
       WHERE c.state = 'active' GROUP BY s.state`,
    )
    .all() as { state: string; count: number }[];
  const states: Record<string, number> = { new: 0, learning: 0, review: 0, relearning: 0 };
  for (const row of stateRows) states[row.state] = row.count;

  const dueRows = raw
    .prepare(
      `SELECT s.due AS due FROM scheduling s JOIN cards c ON c.id = s.card_id
       WHERE c.state = 'active' AND s.suspended = 0 AND s.due < ?`,
    )
    .all(today + 30 * DAY) as { due: number }[];
  const dueCounts = new Map<string, number>();
  for (const row of dueRows) {
    const bucket = row.due < today ? localDayKey(today) : localDayKey(row.due);
    dueCounts.set(bucket, (dueCounts.get(bucket) ?? 0) + 1);
  }
  const forecast = Array.from({ length: 30 }, (_, i) => {
    const key = localDayKey(today + i * DAY);
    return { day: key, count: dueCounts.get(key) ?? 0 };
  });

  let streak = 0;
  const activeDays = new Set(reviewRows.map((row) => localDayKey(row.reviewedAt)));
  let cursor = activeDays.has(localDayKey(today)) ? today : today - DAY;
  while (activeDays.has(localDayKey(cursor))) {
    streak += 1;
    cursor -= DAY;
  }

  return c.json({ heatmap, retention, states, forecast, streak });
});
