import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";
import type { GameState } from "@skills/core";

describe("game api", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const state = async (skill = "guitar") =>
    (await (await app.request(`/api/game/${skill}/state`)).json()) as GameState;
  const log = async (body: object, skill = "guitar") =>
    (await (await send("POST", `/api/game/${skill}/log`, body)).json()) as {
      xpGained: number;
      suggestion: number | null;
      isRecord: boolean;
    };

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("reports a clean state for a new player", async () => {
    const s = await state();
    expect(s.placed).toBe(false);
    expect(s.level).toBe(1);
    expect(s.streak).toBe(0);
    expect(s.today).toBeNull();
    expect(s.title).toBe("Wandering Novice");
  });

  it("adds logged time and XP to the state", async () => {
    await log({ kind: "frei", seconds: 600, level: 1 });
    const s = await state();
    expect(s.totalSeconds).toBe(600);
    expect(s.xp).toBe(40);
    expect(s.streak).toBe(1);
  });

  it("derives XP from entries, not a stored total", async () => {
    database.raw
      .prepare(
        "INSERT INTO game_log (skill_id, day, at, kind, seconds, level) VALUES ('guitar','2026-01-01',1,'frei',1500,1)",
      )
      .run();
    expect((await state()).xp).toBe(100);
  });

  it("suggests a higher level after two too-easy results", async () => {
    const entry = { kind: "quest", questId: "q", techniqueId: "t", seconds: 60, level: 3, rating: "zu-leicht" };
    expect((await log(entry)).suggestion).toBeNull();
    expect((await log(entry)).suggestion).toBe(4);
  });

  it("marks a new metric record once", async () => {
    const m = (v: number) => ({ kind: "quest", seconds: 10, level: 1, metricKey: "wpm", metricValue: v });
    expect((await log(m(20))).isRecord).toBe(true);
    expect((await log(m(18))).isRecord).toBe(false);
    expect((await log(m(22))).isRecord).toBe(true);
    expect((await state()).records.wpm).toBe(22);
  });

  it("moves a lesson to aktiv, then gemeistert at the target", async () => {
    const base = { kind: "quest", lessonId: "L1", seconds: 60, level: 1, masteryTarget: 80 };
    await log({ ...base, metricKey: "m", metricValue: 50 });
    expect((await state()).lessons.L1).toBe("aktiv");
    await log({ ...base, metricKey: "m", metricValue: 85 });
    expect((await state()).lessons.L1).toBe("gemeistert");
  });

  it("never downgrades a mastered lesson", async () => {
    await send("PUT", "/api/game/guitar/lesson/L1", { status: "gemeistert" });
    await log({ kind: "quest", lessonId: "L1", seconds: 60, level: 1, rating: "zu-schwer" });
    expect((await state()).lessons.L1).toBe("gemeistert");
    await send("POST", "/api/game/guitar/placement", { knownLessonIds: ["L1"], levels: {}, targetSongId: "db:1" });
    expect((await state()).lessons.L1).toBe("gemeistert");
  });

  it("treats old course progress as gelernt", async () => {
    await send("PUT", "/api/progress/guitar/01-haltung", { status: "done" });
    expect((await state()).lessons["01-haltung"]).toBe("gelernt");
  });

  it("stores placement and keeps today's quests stable across reads", async () => {
    await send("POST", "/api/game/guitar/placement", {
      knownLessonIds: ["a"],
      levels: { t1: 4 },
      targetSongId: "uebung:7",
    });
    await send("PUT", "/api/game/guitar/today", { minutes: 15, questIds: ["x", "y"] });
    const a = await state();
    const b = await state();
    expect(a.today).toEqual({ minutes: 15, questIds: ["x", "y"] });
    expect(b.today).toEqual(a.today);
    expect(a.placed).toBe(true);
    expect(a.targetSongId).toBe("uebung:7");
    expect(a.levels.t1).toBe(4);
    expect(a.lessons.a).toBe("gelernt");
    await send("PUT", "/api/game/guitar/level/t1", { level: 6 });
    expect((await state()).levels.t1).toBe(6);
  });

  it("lists done quests today", async () => {
    await log({ kind: "quest", questId: "q1", seconds: 60, level: 1 });
    expect((await state()).doneToday).toEqual(["q1"]);
  });

  it("rejects a level of 11 and negative seconds with 400 invalid_body", async () => {
    const r1 = await send("PUT", "/api/game/guitar/level/t", { level: 11 });
    expect(r1.status).toBe(400);
    expect(((await r1.json()) as { error: { code: string } }).error.code).toBe("invalid_body");
    const r2 = await send("POST", "/api/game/guitar/log", { kind: "frei", seconds: -1, level: 1 });
    expect(r2.status).toBe(400);
    expect(((await r2.json()) as { error: { code: string } }).error.code).toBe("invalid_body");
  });

  it("rejects a log of more than four hours", async () => {
    const r = await send("POST", "/api/game/guitar/log", { kind: "frei", seconds: 14401, level: 1 });
    expect(r.status).toBe(400);
  });

  it("keeps skills apart", async () => {
    await log({ kind: "frei", seconds: 600, level: 1 });
    const s = await state("demo");
    expect(s.totalSeconds).toBe(0);
    expect(s.xp).toBe(0);
  });
  describe("chosen lessons, quick wins and target song", () => {
    const choose = (id: string, body?: object, skill = "guitar") =>
      send("PUT", `/api/game/${skill}/chosen/${id}`, body ?? {});

    it("lists chosen lessons oldest first", async () => {
      await choose("a");
      await choose("b");
      expect((await state()).chosenLessons).toEqual(["a", "b"]);
    });

    it("moves an open lesson to aktiv when chosen", async () => {
      await choose("a");
      expect((await state()).lessons.a).toBe("aktiv");
    });

    it("refuses a third chosen lesson with 409 limit and changes nothing", async () => {
      await choose("a");
      await choose("b");
      const r = await choose("c");
      expect(r.status).toBe(409);
      expect(((await r.json()) as { error: { code: string } }).error.code).toBe("limit");
      const s = await state();
      expect(s.chosenLessons).toEqual(["a", "b"]);
      expect(s.lessons.c).toBeUndefined();
    });

    it("replaces a chosen lesson in one step", async () => {
      await choose("a");
      await choose("b");
      const r = await choose("c", { replace: "a" });
      expect(r.status).toBe(200);
      expect((await state()).chosenLessons).toEqual(["b", "c"]);
    });

    it("ignores a bogus replace at the limit", async () => {
      await choose("a");
      await choose("b");
      const r = await choose("c", { replace: "zzz" });
      expect(r.status).toBe(409);
      expect((await state()).chosenLessons).toEqual(["a", "b"]);
    });

    it("accepts choosing an already chosen lesson again", async () => {
      await choose("a");
      await choose("b");
      expect((await choose("a")).status).toBe(200);
      expect((await state()).chosenLessons).toEqual(["a", "b"]);
    });

    it("frees the slot when a chosen lesson is gelernt", async () => {
      await choose("a");
      await choose("b");
      await send("PUT", "/api/game/guitar/lesson/a", { status: "gelernt" });
      expect((await state()).chosenLessons).toEqual(["b"]);
      expect((await choose("c")).status).toBe(200);
      expect((await state()).chosenLessons).toEqual(["b", "c"]);
    });

    it("removes a chosen lesson with DELETE", async () => {
      await choose("a");
      expect((await send("DELETE", "/api/game/guitar/chosen/a")).status).toBe(200);
      expect((await state()).chosenLessons).toEqual([]);
    });

    it("makes a quick lesson gelernt after one passing quest", async () => {
      await log({ kind: "quest", questId: "q", lessonId: "l", seconds: 60, level: 1, rating: "passt", quick: true });
      expect((await state()).lessons.l).toBe("gelernt");
    });

    it("leaves a quick lesson aktiv after zu-schwer", async () => {
      await log({ kind: "quest", questId: "q", lessonId: "l", seconds: 60, level: 1, rating: "zu-schwer", quick: true });
      expect((await state()).lessons.l).toBe("aktiv");
    });

    it("does not lower gemeistert through a quick log", async () => {
      await send("PUT", "/api/game/guitar/lesson/l", { status: "gemeistert" });
      await log({ kind: "quest", questId: "q", lessonId: "l", seconds: 60, level: 1, rating: "passt", quick: true });
      expect((await state()).lessons.l).toBe("gemeistert");
    });

    it("sets and clears the target song", async () => {
      expect((await send("PUT", "/api/game/guitar/target-song", { targetSongId: "db:12" })).status).toBe(200);
      expect((await state()).targetSongId).toBe("db:12");
      expect((await send("PUT", "/api/game/guitar/target-song", { targetSongId: null })).status).toBe(200);
      expect((await state()).targetSongId).toBeNull();
    });

    it("rejects a malformed target song id", async () => {
      const r = await send("PUT", "/api/game/guitar/target-song", { targetSongId: "nope" });
      expect(r.status).toBe(400);
    });

    it("keeps chosen lessons apart per skill", async () => {
      await choose("a");
      expect((await state("demo")).chosenLessons).toEqual([]);
    });
  });
});
