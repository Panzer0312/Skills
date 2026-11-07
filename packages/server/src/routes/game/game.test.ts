import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { openDatabase, type AppDatabase } from "../../db/client.js";
import { localDayKey, type GameState } from "@skills/core";

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

  it("does not call a first value of 0 a record", async () => {
    const m = (v: number) => ({ kind: "quest", seconds: 10, level: 1, metricKey: "hits", metricValue: v });
    expect((await log(m(0))).isRecord).toBe(false);
    expect((await log(m(1))).isRecord).toBe(true);
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

  it("reports the local day in the state", async () => {
    expect((await state()).day).toBe(localDayKey(Date.now()));
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

    it("does not count the main-road lesson towards the limit", async () => {
      await choose("road");
      await choose("a");
      const r = await choose("b", { mainRoad: "road" });
      expect(r.status).toBe(200);
      expect((await state()).chosenLessons).toEqual(["road", "a", "b"]);
    });

    it("still refuses a third side lesson beside the main-road lesson", async () => {
      await choose("road");
      await choose("a");
      await choose("b", { mainRoad: "road" });
      const r = await choose("c", { mainRoad: "road" });
      expect(r.status).toBe(409);
      expect((await state()).chosenLessons).toEqual(["road", "a", "b"]);
    });

    it("lets the main-road lesson itself in at the limit", async () => {
      await choose("a");
      await choose("b");
      expect((await choose("road", { mainRoad: "road" })).status).toBe(200);
      expect((await state()).chosenLessons).toEqual(["a", "b", "road"]);
    });

    it("counts every chosen lesson when no main road is sent", async () => {
      await choose("road");
      await choose("a");
      expect((await choose("b")).status).toBe(409);
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

  describe("song meta", () => {
    const songs = async (skill = "guitar") =>
      (await (await app.request(`/api/game/${skill}/songs`)).json()) as {
        songs: Record<string, { stars: number; lastPlayedAt: number | null; tags: string[] }>;
      };

    it("returns an empty map for a new skill", async () => {
      expect((await songs()).songs).toEqual({});
    });

    it("stores tags and stars per song", async () => {
      expect((await send("PUT", "/api/game/guitar/song/song:12", { stars: 4, tags: ["barre"] })).status).toBe(200);
      await send("PUT", "/api/game/guitar/song/uebung:x", { stars: 1 });
      const { songs: map } = await songs();
      expect(map["song:12"]).toEqual({ stars: 4, lastPlayedAt: null, tags: ["barre"] });
      expect(map["uebung:x"]).toEqual({ stars: 1, lastPlayedAt: null, tags: [] });
      expect((await songs("demo")).songs).toEqual({});
    });

    it("keeps stars when only played is sent", async () => {
      await send("PUT", "/api/game/guitar/song/song:12", { stars: 3, tags: ["a"] });
      const before = Date.now();
      await send("PUT", "/api/game/guitar/song/song:12", { played: true });
      const meta = (await songs()).songs["song:12"]!;
      expect(meta.stars).toBe(3);
      expect(meta.tags).toEqual(["a"]);
      expect(meta.lastPlayedAt).toBeGreaterThanOrEqual(before);
    });

    it("rejects six stars", async () => {
      const res = await send("PUT", "/api/game/guitar/song/song:12", { stars: 6 });
      expect(res.status).toBe(400);
      expect((await songs()).songs).toEqual({});
    });

    it("rejects an unknown key form", async () => {
      expect((await send("PUT", "/api/game/guitar/song/db:12", { stars: 1 })).status).toBe(400);
      expect((await send("PUT", "/api/game/guitar/song/12", { stars: 1 })).status).toBe(400);
    });
  });

  describe("history", () => {
    const history = async (skill = "guitar") =>
      (await (await app.request(`/api/game/${skill}/history`)).json()) as import("@skills/core").History;
    const insert = (day: string, seconds: number, key: string | null, value: number | null) =>
      database.raw
        .prepare(
          "INSERT INTO game_log (skill_id, day, at, kind, seconds, level, metric_key, metric_value) VALUES ('guitar', ?, 1, 'frei', ?, 1, ?, ?)",
        )
        .run(day, seconds, key, value);

    it("sums the seconds per day", async () => {
      insert("2026-11-01", 300, null, null);
      insert("2026-11-01", 120, null, null);
      insert("2026-11-02", 60, null, null);
      expect((await history()).days).toEqual([
        { day: "2026-11-01", seconds: 420 },
        { day: "2026-11-02", seconds: 60 },
      ]);
    });

    it("keeps the best metric per key and day", async () => {
      insert("2026-11-01", 60, "wechsel:Am-C", 20);
      insert("2026-11-01", 60, "wechsel:Am-C", 34);
      insert("2026-11-02", 60, "wechsel:Am-C", 30);
      insert("2026-11-01", 60, "tempo", 90);
      const { metrics } = await history();
      expect(metrics).toContainEqual({ key: "wechsel:Am-C", day: "2026-11-01", value: 34 });
      expect(metrics).toContainEqual({ key: "wechsel:Am-C", day: "2026-11-02", value: 30 });
      expect(metrics).toHaveLength(3);
    });

    it("does not mix skills", async () => {
      expect(await history("demo")).toEqual({ days: [], metrics: [] });
    });
  });

  it("stores seen story beats once and reports them in the state", async () => {
    expect((await state()).storySeen).toEqual([]);
    expect((await send("PUT", "/api/game/guitar/story/seen", { beatIds: ["a", "b"] })).status).toBe(200);
    await send("PUT", "/api/game/guitar/story/seen", { beatIds: ["b", "c"] });
    expect((await state()).storySeen).toEqual(["a", "b", "c"]);
    expect((await state("other")).storySeen).toEqual([]);
  });

  it("rejects too many or empty story beat ids", async () => {
    const many = Array.from({ length: 201 }, (_, i) => `b${i}`);
    expect((await send("PUT", "/api/game/guitar/story/seen", { beatIds: many })).status).toBe(400);
    expect((await send("PUT", "/api/game/guitar/story/seen", { beatIds: [""] })).status).toBe(400);
    expect((await send("PUT", "/api/game/guitar/story/seen", {})).status).toBe(400);
  });
});

describe("game gear api", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const state = async () => (await (await app.request("/api/game/guitar/state")).json()) as GameState;
  const addGold = (gold: number) =>
    database.raw
      .prepare(
        "INSERT INTO game_log (skill_id, day, at, kind, seconds, level) VALUES ('guitar','2026-01-01',1,'frei',?,1)",
      )
      .run(gold * 75); // 75 s of free play = 5 XP = 1 gold
  const buy = (itemId: string) => send("POST", "/api/game/guitar/market/buy", { itemId });
  const setLesson = (id: string, status: string) => send("PUT", `/api/game/guitar/lesson/${id}`, { status });

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("starts with no gold, nothing owned, sound off", async () => {
    const s = await state();
    expect(s.gold).toBe(0);
    expect(s.owned).toEqual([]);
    expect(s.equipped).toEqual({});
    expect(s.sound).toBe(false);
  });

  it("pays gold for logged practice", async () => {
    const res = (await (await send("POST", "/api/game/guitar/log", { kind: "frei", seconds: 750, level: 1 })).json()) as {
      goldGained: number;
    };
    expect(res.goldGained).toBe(10);
    expect((await state()).gold).toBe(10);
  });

  it("buys an item and lowers gold", async () => {
    addGold(100);
    const res = await buy("wanderdolch");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ gold: 70 });
    const s = await state();
    expect(s.gold).toBe(70);
    expect(s.owned).toEqual(["wanderdolch"]);
  });

  it("charges once when the same item is bought twice", async () => {
    addGold(100);
    expect((await buy("wanderdolch")).status).toBe(200);
    const second = await buy("wanderdolch");
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ error: "Schon in deinem Besitz", reason: "schon-besessen" });
    expect((await state()).gold).toBe(70);
  });

  it("never pushes gold below zero", async () => {
    addGold(100);
    const res = await buy("eisenhelm"); // costs 120
    expect(res.status).toBe(409);
    expect(((await res.json()) as { reason: string }).reason).toBe("zu-wenig-gold");
    expect((await state()).gold).toBe(100);
  });

  it("refuses a second item when the sum exceeds gold", async () => {
    addGold(130);
    expect((await buy("eisenhelm")).status).toBe(200);
    const second = await buy("kurzschwert");
    expect(second.status).toBe(409);
    expect(((await second.json()) as { reason: string }).reason).toBe("zu-wenig-gold");
    expect((await state()).gold).toBe(10);
  });

  it("refuses milestone and unknown items", async () => {
    addGold(1000);
    const m = await buy("barre-urkunde");
    expect(m.status).toBe(409);
    expect(((await m.json()) as { reason: string }).reason).toBe("nicht-kaeuflich");
    const u = await buy("quatsch");
    expect(u.status).toBe(409);
    expect(((await u.json()) as { reason: string }).reason).toBe("unbekannt");
    expect((await state()).gold).toBe(1000);
  });

  it("equips, replaces and unequips", async () => {
    addGold(500);
    await buy("wanderdolch");
    await buy("kurzschwert");
    expect((await send("PUT", "/api/game/guitar/equip", { slot: "waffe", itemId: "wanderdolch" })).status).toBe(200);
    expect((await state()).equipped).toEqual({ waffe: "wanderdolch" });
    await send("PUT", "/api/game/guitar/equip", { slot: "waffe", itemId: "kurzschwert" });
    expect((await state()).equipped).toEqual({ waffe: "kurzschwert" });
    expect((await send("PUT", "/api/game/guitar/equip", { slot: "waffe", itemId: null })).status).toBe(200);
    expect((await state()).equipped).toEqual({});
  });

  it("rejects the wrong slot and unowned items", async () => {
    addGold(500);
    await buy("wanderdolch");
    const wrong = await send("PUT", "/api/game/guitar/equip", { slot: "kopf", itemId: "wanderdolch" });
    expect(wrong.status).toBe(400);
    const unowned = await send("PUT", "/api/game/guitar/equip", { slot: "waffe", itemId: "kurzschwert" });
    expect(unowned.status).toBe(400);
    const bad = await send("PUT", "/api/game/guitar/equip", { slot: "hut", itemId: null });
    expect(bad.status).toBe(400);
  });

  it("hides an equipped milestone item when its lesson goes back to aktiv", async () => {
    await setLesson("10-barre", "gelernt");
    expect((await send("PUT", "/api/game/guitar/equip", { slot: "talisman", itemId: "barre-urkunde" })).status).toBe(200);
    expect((await state()).equipped).toEqual({ talisman: "barre-urkunde" });
    await setLesson("10-barre", "aktiv");
    const s = await state();
    expect(s.equipped).toEqual({});
    expect(s.owned).toEqual([]);
    await setLesson("10-barre", "gelernt");
    expect((await state()).equipped).toEqual({ talisman: "barre-urkunde" });
  });

  it("round trips the sound setting", async () => {
    expect((await send("PUT", "/api/game/guitar/settings", { sound: true })).status).toBe(200);
    expect((await state()).sound).toBe(true);
    await send("PUT", "/api/game/guitar/settings", { sound: false });
    expect((await state()).sound).toBe(false);
    expect((await send("PUT", "/api/game/guitar/settings", { sound: "ja" })).status).toBe(400);
  });
});

describe("game log undo and export", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const state = async () => (await (await app.request("/api/game/guitar/state")).json()) as GameState;
  const log = async (body: object, skill = "guitar") =>
    (await (await send("POST", `/api/game/${skill}/log`, body)).json()) as { logId: number };

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("log returns logId and recent lists it first", async () => {
    const first = await log({ kind: "frei", seconds: 60, level: 1 });
    const second = await log({ kind: "frei", seconds: 120, level: 1 });
    expect(second.logId).toBeGreaterThan(first.logId);
    const recent = (await (await app.request("/api/game/guitar/log/recent")).json()) as {
      entries: { id: number; seconds: number; kind: string }[];
    };
    expect(recent.entries).toHaveLength(2);
    expect(recent.entries[0]?.id).toBe(second.logId);
    expect(recent.entries[0]?.seconds).toBe(120);
  });

  it("delete removes the entry from state totals", async () => {
    const { logId } = await log({ kind: "frei", seconds: 600, level: 1 });
    const res = await send("DELETE", `/api/game/guitar/log/${logId}`);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    const s = await state();
    expect(s.totalSeconds).toBe(0);
    expect(s.xp).toBe(0);
  });

  it("delete of unknown id is 404", async () => {
    const res = await send("DELETE", "/api/game/guitar/log/9999");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: { code: "not_found", message: "Eintrag nicht gefunden." } });
  });

  it("delete of another skill's id is 404", async () => {
    const { logId } = await log({ kind: "frei", seconds: 60, level: 1 }, "other");
    expect((await send("DELETE", `/api/game/guitar/log/${logId}`)).status).toBe(404);
    expect((await send("DELETE", `/api/game/other/log/${logId}`)).status).toBe(200);
  });

  it("delete after spending gold keeps state loading", async () => {
    const { logId } = await log({ kind: "frei", seconds: 75 * 40, level: 1 }); // 40 gold
    expect((await send("POST", "/api/game/guitar/market/buy", { itemId: "wanderdolch" })).status).toBe(200);
    await send("DELETE", `/api/game/guitar/log/${logId}`);
    const res = await app.request("/api/game/guitar/state");
    expect(res.status).toBe(200);
    expect(((await res.json()) as GameState).gold).toBe(0);
  });

  it("export contains the log rows", async () => {
    await log({ kind: "frei", seconds: 60, level: 1 });
    const res = await app.request("/api/game/guitar/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-disposition")).toContain("guitar-export-");
    const body = (await res.json()) as { skillId: string; tables: Record<string, unknown[]> };
    expect(body.skillId).toBe("guitar");
    expect(body.tables.game_log).toHaveLength(1);
    expect(body.tables.lesson_progress).toEqual([]);
  });
});
