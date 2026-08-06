import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";
import { syncSkill } from "../services/seedSync.js";

function seed(database: AppDatabase, keys: string[]) {
  syncSkill(
    database,
    {
      skillId: "demo",
      name: "Demo",
      modules: [{ id: "cards", type: "srs-deck", title: "Karten" }],
      cards: keys.map((key) => ({ moduleId: "cards", cardKey: key, front: key, back: `${key}!`, tags: [] })),
    },
    Date.now() - 1000,
  );
}

describe("queue and reviews", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("returns due cards with a preview for every rating", async () => {
    seed(database, ["a"]);
    const res = await app.request("/api/queue?skillId=demo");
    expect(res.status).toBe(200);
    const body = (await res.json()) as { cards: any[] };
    expect(body.cards).toHaveLength(1);
    expect(body.cards[0].cardKey).toBe("a");
    expect(body.cards[0].back.text).toBe("a!");
    expect(Object.keys(body.cards[0].preview).sort()).toEqual(["1", "2", "3", "4"]);
    expect(body.cards[0].preview["4"].due).toBeGreaterThan(body.cards[0].preview["1"].due);
  });

  it("advances scheduling and logs a review", async () => {
    seed(database, ["a"]);
    const queued = (await (await app.request("/api/queue?skillId=demo")).json()) as { cards: { id: number }[] };
    const cardId = queued.cards[0]!.id;

    const res = await app.request("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId, rating: 4, elapsedMs: 1500 }),
    });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { scheduling: { state: string; reps: number } };
    expect(body.scheduling.state).toBe("review");
    expect(body.scheduling.reps).toBe(1);

    const logged = database.raw.prepare("SELECT rating, elapsed_ms FROM reviews").get() as {
      rating: number;
      elapsed_ms: number;
    };
    expect(logged.rating).toBe(4);
    expect(logged.elapsed_ms).toBe(1500);
  });

  it("rejects an invalid rating", async () => {
    seed(database, ["a"]);
    const res = await app.request("/api/reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ cardId: 1, rating: 9 }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("invalid_body");
  });

  it("excludes suspended cards from the queue", async () => {
    seed(database, ["a"]);
    await app.request("/api/cards/1/suspend", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ suspended: true }),
    });
    const body = (await (await app.request("/api/queue?skillId=demo")).json()) as { cards: unknown[] };
    expect(body.cards).toHaveLength(0);
  });

  it("excludes buried cards until their bury time passes", async () => {
    seed(database, ["a"]);
    await app.request("/api/cards/1/bury", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ untilTs: Date.now() + 3_600_000 }),
    });
    const body = (await (await app.request("/api/queue?skillId=demo")).json()) as { cards: unknown[] };
    expect(body.cards).toHaveLength(0);
  });

  it("honours the daily new-card limit from settings", async () => {
    seed(database, ["a", "b", "c"]);
    database.raw.prepare("INSERT INTO settings (key, value) VALUES ('dailyNew', '2')").run();
    const body = (await (await app.request("/api/queue?skillId=demo")).json()) as { cards: unknown[] };
    expect(body.cards).toHaveLength(2);
  });
});
