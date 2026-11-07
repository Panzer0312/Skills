import { beforeEach, describe, expect, it } from "vitest";
import type { GameState } from "@skills/core";
import { createApp } from "../../app.js";
import { openDatabase, type AppDatabase } from "../../db/client.js";

describe("settings and sound", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const state = async () => (await (await send("GET", "/api/game/guitar/state")).json()) as GameState;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  it("state.sound follows the pref", async () => {
    expect((await state()).sound).toBe(false);
    await send("PUT", "/api/game/guitar/prefs", { key: "klang.an", value: true });
    expect((await state()).sound).toBe(true);
    await send("PUT", "/api/game/guitar/prefs", { key: "klang.an", value: false });
    expect((await state()).sound).toBe(false);
  });

  it("state.sound falls back to the old setting without a pref", async () => {
    database.raw.prepare("INSERT INTO game_settings (skill_id, sound) VALUES ('guitar', 1)").run();
    expect((await state()).sound).toBe(true);
  });

  it("PUT /settings writes the pref too", async () => {
    await send("PUT", "/api/game/guitar/settings", { sound: true });
    const prefs = ((await (await send("GET", "/api/game/guitar/prefs")).json()) as { prefs: Record<string, unknown> })
      .prefs;
    expect(prefs["klang.an"]).toBe(true);
    expect((await state()).sound).toBe(true);
  });

  it("export is named after the skill and leaves other skills out", async () => {
    database.raw
      .prepare("INSERT INTO game_log (skill_id, day, at, kind, seconds, level) VALUES ('guitar','2026-01-01',1,'frei',60,1)")
      .run();
    database.raw
      .prepare("INSERT INTO game_log (skill_id, day, at, kind, seconds, level) VALUES ('piano','2026-01-01',1,'frei',90,1)")
      .run();
    const res = await send("GET", "/api/game/guitar/export");
    expect(res.headers.get("content-disposition")).toMatch(/filename="guitar-export-\d{4}-\d{2}-\d{2}\.json"/);
    const body = (await res.json()) as { tables: Record<string, { skill_id: string }[]> };
    expect(body.tables.game_log!).toHaveLength(1);
    expect(body.tables.game_log!.every((r) => r.skill_id === "guitar")).toBe(true);
    const other = await send("GET", "/api/game/piano/export");
    expect(other.headers.get("content-disposition")).toContain("piano-export-");
  });

  it("export contains this skill's prefs only", async () => {
    await send("PUT", "/api/game/guitar/prefs", { key: "klang.an", value: true });
    await send("PUT", "/api/game/piano/prefs", { key: "intro.gesehen", value: true });
    const body = (await (await send("GET", "/api/game/guitar/export")).json()) as {
      tables: Record<string, { skill_id: string; key: string }[]>;
    };
    const rows = body.tables.game_prefs ?? [];
    expect(rows.map((r) => r.key)).toEqual(["klang.an"]);
    expect(rows.every((r) => r.skill_id === "guitar")).toBe(true);
  });

  it("export contains the gold adjustments of this skill", async () => {
    database.raw.prepare("INSERT INTO game_gold_adjust (skill_id, at, amount) VALUES ('guitar', 1, 5)").run();
    database.raw.prepare("INSERT INTO game_gold_adjust (skill_id, at, amount) VALUES ('piano', 1, 9)").run();
    const body = (await (await send("GET", "/api/game/guitar/export")).json()) as {
      tables: Record<string, { amount: number }[]>;
    };
    expect(body.tables.game_gold_adjust).toEqual([expect.objectContaining({ amount: 5 })]);
  });
});
