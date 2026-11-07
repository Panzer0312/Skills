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
});
