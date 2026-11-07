import { Hono } from "hono";
import type { AppEnv } from "../../app.js";
import { router as lessons } from "./lessons.js";
import { router as log } from "./log.js";
import { router as market } from "./market.js";
import { router as prefs } from "./prefs.js";
import { router as settings } from "./settings.js";
import { router as songs } from "./songs.js";
import { router as state } from "./state.js";

export const gameRoutes = new Hono<AppEnv>();

for (const router of [state, log, lessons, songs, market, settings, prefs]) gameRoutes.route("/", router);
