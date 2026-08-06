import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";

const DAY = 86_400_000;

function addReview(database: AppDatabase, at: number, rating: number, stateBefore: string) {
  database.raw
    .prepare(
      `INSERT INTO reviews (card_id, reviewed_at, rating, elapsed_ms, state_before, state_after)
       VALUES (1, ?, ?, 0, ?, 'review')`,
    )
    .run(at, rating, stateBefore);
}

describe("stats, settings and progress", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("computes retention from review-state ratings only", async () => {
    addReview(database, Date.now(), 3, "review");
    addReview(database, Date.now(), 1, "review");
    addReview(database, Date.now(), 1, "new");
    const body = (await (await app.request("/api/stats")).json()) as { retention: number };
    expect(body.retention).toBeCloseTo(0.5, 5);
  });

  it("counts a streak across consecutive days", async () => {
    const now = Date.now();
    addReview(database, now, 3, "review");
    addReview(database, now - DAY, 3, "review");
    addReview(database, now - 2 * DAY, 3, "review");
    const body = (await (await app.request("/api/stats")).json()) as { streak: number };
    expect(body.streak).toBe(3);
  });

  it("stores and returns settings", async () => {
    const put = await app.request("/api/settings", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ dailyNew: "15", theme: "dark" }),
    });
    expect(put.status).toBe(200);
    const body = (await (await app.request("/api/settings")).json()) as { settings: Record<string, string> };
    expect(body.settings.dailyNew).toBe("15");
    expect(body.settings.theme).toBe("dark");
  });

  it("stores lesson progress and reads it back", async () => {
    await app.request("/api/progress/guitar/01-haltung", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "done", checkpoint: { bpm: 60 } }),
    });
    const body = (await (await app.request("/api/progress/guitar")).json()) as {
      lessons: { lessonId: string; status: string; checkpoint: { bpm: number } }[];
    };
    expect(body.lessons).toHaveLength(1);
    expect(body.lessons[0]?.status).toBe("done");
    expect(body.lessons[0]?.checkpoint.bpm).toBe(60);
  });

  it("rejects an unknown lesson status", async () => {
    const res = await app.request("/api/progress/guitar/01", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status: "halbfertig" }),
    });
    expect(res.status).toBe(400);
  });
});
