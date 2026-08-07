import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";
import { buildTestApkg } from "../services/apkg/testDeck.js";

function form(bytes: Uint8Array, options?: unknown): FormData {
  const data = new FormData();
  data.set("file", new Blob([bytes as BlobPart]), "deck.apkg");
  if (options) data.set("options", JSON.stringify(options));
  return data;
}

describe("anki routes", () => {
  let dir: string;
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "anki-route-"));
    database = openDatabase(join(dir, "app.db"));
    app = createApp(database);
  });

  afterEach(() => {
    database.close();
    rmSync(dir, { recursive: true, force: true });
  });

  const deck = () =>
    buildTestApkg({
      deckName: "Kaishi Mini",
      fieldNames: ["Expression", "Meaning", "Reading"],
      notes: [
        { fields: ["日本", "Japan", "にほん"], tags: ["land"] },
        { fields: ["学生", "Student", "がくせい"], tags: [] },
      ],
      media: { "nihon.mp3": "TON" },
    });

  it("previews a deck without writing anything", async () => {
    const res = await app.request("/api/anki/preview", { method: "POST", body: form(deck()) });
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      deckName: string;
      noteCount: number;
      cardCount: number;
      mediaCount: number;
      samples: { front: string; back: string }[];
      suggestedMapping: Record<string, { front: number; back: number; reading: number | null }>;
    };

    expect(body.deckName).toBe("Kaishi Mini");
    expect(body.noteCount).toBe(2);
    expect(body.cardCount).toBe(2);
    expect(body.mediaCount).toBe(1);
    expect(body.samples[0]?.front).toBe("日本");
    expect(Object.values(body.suggestedMapping)[0]).toMatchObject({ front: 0, back: 1, reading: 2 });

    const written = database.raw.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number };
    expect(written.n).toBe(0);
  });

  it("imports notes, cards and media", async () => {
    const preview = (await (
      await app.request("/api/anki/preview", { method: "POST", body: form(deck()) })
    ).json()) as { suggestedMapping: Record<string, unknown> };

    const res = await app.request("/api/anki/import", {
      method: "POST",
      body: form(deck(), {
        skillId: "japanese",
        moduleId: "kaishi",
        moduleTitle: "Kaishi Mini",
        mapping: preview.suggestedMapping,
        keepScheduling: false,
      }),
    });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notes: 2, cards: 2, media: 1 });

    const card = database.raw
      .prepare("SELECT front_json, back_json, tags FROM cards ORDER BY id LIMIT 1")
      .get() as { front_json: string; back_json: string; tags: string };
    expect(JSON.parse(card.front_json).text).toBe("日本");
    expect(JSON.parse(card.back_json).reading).toBe("にほん");
    expect(JSON.parse(card.tags)).toEqual(["land"]);

    const scheduled = database.raw.prepare("SELECT state FROM scheduling").all() as { state: string }[];
    expect(scheduled.every((row) => row.state === "new")).toBe(true);
  });

  it("carries over the anki scheduling when asked", async () => {
    const preview = (await (
      await app.request("/api/anki/preview", { method: "POST", body: form(deck()) })
    ).json()) as { suggestedMapping: Record<string, unknown> };

    await app.request("/api/anki/import", {
      method: "POST",
      body: form(deck(), {
        skillId: "japanese",
        moduleId: "kaishi",
        moduleTitle: "Kaishi Mini",
        mapping: preview.suggestedMapping,
        keepScheduling: true,
      }),
    });

    const row = database.raw.prepare("SELECT state, stability, reps FROM scheduling LIMIT 1").get() as {
      state: string;
      stability: number;
      reps: number;
    };
    expect(row.state).toBe("review");
    expect(row.stability).toBeCloseTo(10, 5);
    expect(row.reps).toBe(3);
  });

  it("leaves the database untouched when the archive is broken", async () => {
    const res = await app.request("/api/anki/import", {
      method: "POST",
      body: form(new Uint8Array([0, 1, 2]), {
        skillId: "japanese",
        moduleId: "kaputt",
        moduleTitle: "Kaputt",
        mapping: {},
        keepScheduling: false,
      }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("apkg_invalid");

    const written = database.raw.prepare("SELECT COUNT(*) AS n FROM cards").get() as { n: number };
    expect(written.n).toBe(0);
  });

  it("rejects an import without a file", async () => {
    const res = await app.request("/api/anki/import", { method: "POST", body: new FormData() });
    expect(res.status).toBe(400);
  });
});
