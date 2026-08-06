import { serve } from "@hono/node-server";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { createApp } from "./app.js";
import { openDatabase } from "./db/client.js";

const dbPath = process.env.SKILLS_DB_PATH ?? resolve(process.cwd(), "data/app.db");
mkdirSync(dirname(dbPath), { recursive: true });

const database = openDatabase(dbPath);
const app = createApp(database);

serve({ fetch: app.fetch, port: 5174 }, (info) => {
  console.log(`Skills-Server läuft auf http://localhost:${info.port} (DB: ${dbPath})`);
});
