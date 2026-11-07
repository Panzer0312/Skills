import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../../app.js";
import { openDatabase } from "../../db/client.js";

describe("prefs routes", () => {
  let app: ReturnType<typeof createApp>;
  const send = (method: string, path: string, body?: unknown) =>
    app.request(path, {
      method,
      headers: { "content-type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const prefs = async (skill = "guitar") =>
    ((await (await send("GET", `/api/game/${skill}/prefs`)).json()) as { prefs: Record<string, unknown> }).prefs;

  beforeEach(() => {
    app = createApp(openDatabase(":memory:"));
  });

  it("prefs route rejects unknown key", async () => {
    const res = await send("PUT", "/api/game/guitar/prefs", { key: "gibt.es.nicht", value: 1 });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("unknown_pref");
  });

  it("prefs route rejects invalid value", async () => {
    const res = await send("PUT", "/api/game/guitar/prefs", { key: "intro.gesehen", value: "ja" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid_pref");
    expect((await prefs())["intro.gesehen"]).toBe(false);
  });

  it("prefs route rejects a missing value", async () => {
    const res = await send("PUT", "/api/game/guitar/prefs", { key: "intro.gesehen" });
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("invalid_pref");
  });

  it("prefs round trip and reset", async () => {
    expect((await prefs())["intro.gesehen"]).toBe(false);
    expect(await (await send("PUT", "/api/game/guitar/prefs", { key: "intro.gesehen", value: true })).json()).toEqual({ ok: true });
    expect((await prefs())["intro.gesehen"]).toBe(true);
    await send("DELETE", "/api/game/guitar/prefs/intro.gesehen");
    expect((await prefs())["intro.gesehen"]).toBe(false);
    await send("PUT", "/api/game/guitar/prefs", { key: "intro.gesehen", value: true });
    expect(await (await send("DELETE", "/api/game/guitar/prefs")).json()).toEqual({ ok: true });
    expect((await prefs())["intro.gesehen"]).toBe(false);
  });

  it("prefs are scoped by skill", async () => {
    await send("PUT", "/api/game/guitar/prefs", { key: "intro.gesehen", value: true });
    expect((await prefs("piano"))["intro.gesehen"]).toBe(false);
    await send("DELETE", "/api/game/piano/prefs");
    expect((await prefs("guitar"))["intro.gesehen"]).toBe(true);
  });

  describe("sound migration", () => {
    let database: ReturnType<typeof openDatabase>;
    const state = async () =>
      ((await (await send("GET", "/api/game/guitar/state")).json()) as { sound?: boolean; state?: { sound: boolean } });
    beforeEach(() => {
      database = openDatabase(":memory:");
      app = createApp(database);
      database.raw.prepare("INSERT INTO game_settings (skill_id, sound) VALUES ('guitar', 1)").run();
    });

    it("seeds klang.an from the old sound setting when no row exists", async () => {
      expect((await prefs())["klang.an"]).toBe(true);
    });

    it("an explicit klang.an row wins over the old setting", async () => {
      await send("PUT", "/api/game/guitar/prefs", { key: "klang.an", value: false });
      expect((await prefs())["klang.an"]).toBe(false);
    });

    it("reset-all and reset-key make klang.an and the state fallback false", async () => {
      await send("DELETE", "/api/game/guitar/prefs");
      expect((await prefs())["klang.an"]).toBe(false);
      const s = await state();
      expect(s.sound ?? s.state?.sound).toBe(false);
      database.raw.prepare("UPDATE game_settings SET sound = 1").run();
      await send("DELETE", "/api/game/guitar/prefs/klang.an");
      expect((await prefs())["klang.an"]).toBe(false);
      expect(database.raw.prepare("SELECT sound FROM game_settings").get()).toEqual({ sound: 0 });
    });
  });
});
