import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";

describe("backup routes", () => {
  let dir: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "skills-backup-"));
    database = openDatabase(join(dir, "app.db"));
    app = createApp(database);
  });

  afterEach(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  it("exports the database as a binary download", async () => {
    const res = await app.request("/api/backup/export");
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/octet-stream");
    expect(res.headers.get("content-disposition")).toContain("skills-");
    const bytes = new Uint8Array(await res.arrayBuffer());
    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(new TextDecoder().decode(bytes.slice(0, 15))).toBe("SQLite format 3");
  });

  it("writes a dated snapshot next to the database", async () => {
    const res = await app.request("/api/backup/snapshot", { method: "POST" });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { path: string };
    expect(existsSync(body.path)).toBe(true);
    expect(body.path).toContain("backups");
  });

  it("refuses to export an in-memory database", async () => {
    const memory = openDatabase(":memory:");
    const memoryApp = createApp(memory);
    const res = await memoryApp.request("/api/backup/export");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("no_file_database");
    memory.close();
  });
});
