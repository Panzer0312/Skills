import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";

const chordPro = "{title: Übung in Em}\n{start_of_verse}\n[Em]Zeile eins\n{end_of_verse}";

describe("song routes", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  async function post(body: unknown) {
    return app.request("/api/songs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("stores a pasted song and derives title and format", async () => {
    const res = await post({ content: chordPro });
    expect(res.status).toBe(200);
    const body = (await res.json()) as { song: { id: number; title: string; format: string } };
    expect(body.song.title).toBe("Übung in Em");
    expect(body.song.format).toBe("chordpro");
  });

  it("lets the caller override title and artist", async () => {
    const res = await post({ content: chordPro, title: "Eigener Titel", artist: "Ich" });
    const body = (await res.json()) as { song: { title: string; artist: string } };
    expect(body.song.title).toBe("Eigener Titel");
    expect(body.song.artist).toBe("Ich");
  });

  it("lists and fetches stored songs", async () => {
    await post({ content: chordPro });
    const list = (await (await app.request("/api/songs")).json()) as { songs: { id: number }[] };
    expect(list.songs).toHaveLength(1);

    const single = (await (await app.request(`/api/songs/${list.songs[0]!.id}`)).json()) as {
      song: { content: string };
    };
    expect(single.song.content).toContain("Zeile eins");
  });

  it("deletes a song", async () => {
    await post({ content: chordPro });
    const list = (await (await app.request("/api/songs")).json()) as { songs: { id: number }[] };
    const res = await app.request(`/api/songs/${list.songs[0]!.id}`, { method: "DELETE" });
    expect(res.status).toBe(200);
    const after = (await (await app.request("/api/songs")).json()) as { songs: unknown[] };
    expect(after.songs).toHaveLength(0);
  });

  it("rejects empty content", async () => {
    const res = await post({ content: "   " });
    expect(res.status).toBe(400);
  });

  it("rejects a fetch request for a private address", async () => {
    const res = await app.request("/api/songs/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "http://127.0.0.1/secret" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("blocked_host");
  });

  it("rejects a fetch request for a non-http scheme", async () => {
    const res = await app.request("/api/songs/fetch", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "file:///etc/passwd" }),
    });
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("bad_url");
  });

  it("returns 404 for an unknown song", async () => {
    const res = await app.request("/api/songs/999");
    expect(res.status).toBe(404);
  });

  it("removes the song's meta with the song", async () => {
    const a = (await (await post({ content: chordPro })).json()) as { song: { id: number } };
    const b = (await (await post({ content: chordPro })).json()) as { song: { id: number } };
    const put = (key: string) =>
      app.request(`/api/game/guitar/song/${key}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ stars: 2 }),
      });
    await put(`song:${a.song.id}`);
    await put(`song:${b.song.id}`);
    await put("uebung:x");
    await app.request(`/api/songs/${a.song.id}`, { method: "DELETE" });
    const rows = database.raw.prepare("SELECT song_key FROM game_songs ORDER BY song_key").all();
    expect(rows).toEqual([{ song_key: `song:${b.song.id}` }, { song_key: "uebung:x" }]);
    const left = database.raw.prepare("SELECT id FROM songs").all();
    expect(left).toEqual([{ id: b.song.id }]);
  });
});
