import { Hono } from "hono";
import { dirname, join } from "node:path";
import { z } from "zod";
import type { AppEnv } from "../app.js";
import { importApkg } from "../services/apkg/importDeck.js";
import { guessMapping } from "../services/apkg/map.js";
import { ApkgError, readApkg } from "../services/apkg/read.js";

const mappingSchema = z.object({
  front: z.number().int().nonnegative(),
  back: z.number().int().nonnegative(),
  reading: z.number().int().nonnegative().nullable(),
  note: z.number().int().nonnegative().nullable(),
});

const importOptionsSchema = z.object({
  skillId: z.string().min(1),
  moduleId: z.string().min(1),
  moduleTitle: z.string().min(1),
  mapping: z.record(mappingSchema),
  keepScheduling: z.boolean(),
});

export const ankiRoutes = new Hono<AppEnv>();

ankiRoutes.post("/api/anki/preview", async (c) => {
  const form = await c.req.formData();
  const file = form.get("file");
  if (!(file instanceof Blob)) {
    return c.json({ error: { code: "no_file", message: "Es wurde keine Datei übertragen." } }, 400);
  }

  try {
    const content = readApkg(new Uint8Array(await file.arrayBuffer()));
    const suggestedMapping: Record<string, ReturnType<typeof guessMapping>> = {};
    for (const noteType of content.noteTypes) {
      suggestedMapping[String(noteType.id)] = guessMapping(noteType);
    }

    const samples = content.notes.slice(0, 5).map((note) => {
      const mapping = suggestedMapping[String(note.noteTypeId)];
      return {
        front: note.fields[mapping?.front ?? 0] ?? "",
        back: note.fields[mapping?.back ?? 1] ?? "",
      };
    });

    return c.json({
      deckName: content.deckName,
      noteTypes: content.noteTypes,
      noteCount: content.notes.length,
      cardCount: content.cards.length,
      mediaCount: content.media.size,
      samples,
      suggestedMapping,
    });
  } catch (error) {
    if (error instanceof ApkgError) {
      return c.json({ error: { code: "apkg_invalid", message: error.message } }, 400);
    }
    throw error;
  }
});

ankiRoutes.post("/api/anki/import", async (c) => {
  const database = c.get("database");
  const form = await c.req.formData();
  const file = form.get("file");
  const rawOptions = form.get("options");

  if (!(file instanceof Blob)) {
    return c.json({ error: { code: "no_file", message: "Es wurde keine Datei übertragen." } }, 400);
  }

  const parsed = importOptionsSchema.safeParse(
    typeof rawOptions === "string" ? JSON.parse(rawOptions) : null,
  );
  if (!parsed.success) {
    return c.json(
      { error: { code: "invalid_body", message: parsed.error.issues.map((i) => i.message).join("; ") } },
      400,
    );
  }

  try {
    const content = readApkg(new Uint8Array(await file.arrayBuffer()));
    const mediaDir =
      database.path === ":memory:" ? join(process.cwd(), "data/media") : join(dirname(database.path), "media");
    const result = importApkg(database, content, { ...parsed.data, mediaDir }, Date.now());
    return c.json(result);
  } catch (error) {
    if (error instanceof ApkgError) {
      return c.json({ error: { code: "apkg_invalid", message: error.message } }, 400);
    }
    throw error;
  }
});
