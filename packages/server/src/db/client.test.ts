import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";
import { createApp } from "../app.js";

describe("openDatabase", () => {
  it("creates all tables in an in-memory database", () => {
    const database = openDatabase(":memory:");
    const rows = database.raw
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[];
    const names = rows.map((r) => r.name);
    for (const table of [
      "skills", "modules", "cards", "reviews", "scheduling",
      "lesson_progress", "songs", "media", "settings", "notes", "note_types",
    ]) {
      expect(names).toContain(table);
    }
    database.close();
  });
});

describe("createApp", () => {
  it("answers the health route", async () => {
    const database = openDatabase(":memory:");
    const app = createApp(database);
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    database.close();
  });

  it("returns the shared error shape for unknown routes", async () => {
    const database = openDatabase(":memory:");
    const app = createApp(database);
    const res = await app.request("/api/nope");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: "not_found", message: "Route nicht gefunden." },
    });
    database.close();
  });
});
