import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { Hono } from "hono";
import type { AppEnv } from "../app.js";

function stamp(now: number): string {
  const d = new Date(now);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hour = String(d.getHours()).padStart(2, "0");
  const minute = String(d.getMinutes()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${day}_${hour}${minute}`;
}

export const backupRoutes = new Hono<AppEnv>();

backupRoutes.get("/api/backup/export", async (c) => {
  const database = c.get("database");
  if (database.path === ":memory:") {
    return c.json(
      { error: { code: "no_file_database", message: "Es läuft eine Datenbank im Arbeitsspeicher." } },
      400,
    );
  }
  const tmpTarget = join(dirname(database.path), `.export-${Date.now()}.db`);
  await database.backupTo(tmpTarget);
  const bytes = readFileSync(tmpTarget);
  const filename = `skills-${stamp(Date.now()).slice(0, 10)}.db`;
  return c.body(bytes, 200, {
    "content-type": "application/octet-stream",
    "content-disposition": `attachment; filename="${filename}"`,
  });
});

backupRoutes.post("/api/backup/snapshot", async (c) => {
  const database = c.get("database");
  if (database.path === ":memory:") {
    return c.json(
      { error: { code: "no_file_database", message: "Es läuft eine Datenbank im Arbeitsspeicher." } },
      400,
    );
  }
  const dir = join(dirname(database.path), "backups");
  mkdirSync(dir, { recursive: true });
  const target = join(dir, `app-${stamp(Date.now())}.db`);
  await database.backupTo(target);
  return c.json({ path: target });
});
