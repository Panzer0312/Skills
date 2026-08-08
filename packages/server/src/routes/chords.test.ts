import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";

const shape = {
  symbol: "F#m",
  name: "F#m (leichter)",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
};

describe("chord override routes", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  async function put(body: unknown) {
    return app.request("/api/chords", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("stores a global override and returns it", async () => {
    const res = await put({ scope: "global", ...shape });
    expect(res.status).toBe(200);

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toHaveLength(1);
    expect(list.global[0].symbol).toBe("F#m");
    expect(list.global[0].frets).toEqual(shape.frets);
    expect(list.global[0].songKey).toBe("");
    expect(list.song).toEqual([]);
  });

  it("keeps a song override separate from the global one", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "song", songKey: "song:3", ...shape, name: "nur hier" });

    const list = await (await app.request("/api/chords?songKey=song:3")).json();
    expect(list.global).toHaveLength(1);
    expect(list.song).toHaveLength(1);
    expect(list.song[0].name).toBe("nur hier");

    const other = await (await app.request("/api/chords?songKey=song:9")).json();
    expect(other.song).toEqual([]);
  });

  it("updates instead of duplicating on a second put", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "global", ...shape, baseFret: 5 });

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toHaveLength(1);
    expect(list.global[0].baseFret).toBe(5);
  });

  it("lists every entry with all=1", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "song", songKey: "uebung:em-am-wiege", ...shape });

    const body = await (await app.request("/api/chords?all=1")).json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: { songKey: string }) => e.songKey).sort()).toEqual([
      "",
      "uebung:em-am-wiege",
    ]);
  });

  it("rejects an invalid shape", async () => {
    const res = await put({ scope: "global", ...shape, frets: [1, 2, 3] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_body");
  });

  it("answers a wrong array length with a German message", async () => {
    const res = await put({ scope: "global", ...shape, frets: [1, 2, 3] });
    const body = await res.json();
    expect(body.error.message).toBe("Das Griffbild ist ungültig.");
  });

  it("answers a fret above the highest one with a German message", async () => {
    const res = await put({ scope: "global", ...shape, frets: [26, 4, 4, 2, 2, 2] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Das Griffbild ist ungültig.");
  });

  it("answers a finger outside one to four with a German message", async () => {
    const res = await put({ scope: "global", ...shape, fingers: [7, 3, 4, 1, 1, 1] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Das Griffbild ist ungültig.");
  });

  it("rejects a song scope without a song key", async () => {
    const res = await put({ scope: "song", ...shape });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Für einen songbezogenen Griff fehlt der Song.");
  });

  it("rejects a song key on a global scope", async () => {
    const res = await put({ scope: "global", songKey: "song:3", ...shape });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toBe("Ein globaler Griff darf keinen Song tragen.");
  });

  it("deletes idempotently", async () => {
    await put({ scope: "global", ...shape });
    const first = await app.request("/api/chords?scope=global&symbol=F%23m", { method: "DELETE" });
    expect(first.status).toBe(200);
    const second = await app.request("/api/chords?scope=global&symbol=F%23m", { method: "DELETE" });
    expect(second.status).toBe(200);

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toEqual([]);
  });
});
