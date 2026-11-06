import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { gameContent } from "../game/api.js";
import SongLibrary from "./SongLibrary.js";

const bundled = [
  { id: "a", titel: "Wiege", stufe: 1, benoetigteAkkorde: ["Em"], bpm: 80, quelle: "{title: Wiege}\n[Em]la" },
  { id: "b", titel: "Fluss", stufe: 1, benoetigteAkkorde: ["Am"], bpm: 80, quelle: "{title: Fluss}\n[Am]la" },
];
const technique = gameContent.techniques[0]!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function serve(opts: { meta?: Record<string, unknown>; metaFails?: boolean; putFails?: boolean } = {}) {
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const u = String(url);
    if (init?.method === "PUT") {
      return opts.putFails ? json({ error: { code: "x", message: "kaputt" } }, 500) : json({ ok: true });
    }
    if (u.endsWith("/songs") && u.includes("/api/game/")) {
      return opts.metaFails ? json({ error: { code: "x", message: "kaputt" } }, 500) : json({ songs: opts.meta ?? {} });
    }
    if (u.startsWith("/api/chords")) return json({ song: [], global: [] });
    if (u.startsWith("/api/songs")) return json({ songs: [{ id: 7, title: "Eigener", artist: null, content: "[C]la", difficulty: null }] });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const puts = (m: ReturnType<typeof serve>) =>
  m.mock.calls
    .filter(([, init]) => (init as RequestInit | undefined)?.method === "PUT")
    .map(([url, init]) => ({ url: String(url), body: JSON.parse(String((init as RequestInit).body)) }));

function renderLibrary() {
  return render(
    <QueryClientProvider client={queryClient}>
      <SongLibrary data={[bundled]} />
    </QueryClientProvider>,
  );
}

describe("SongLibrary tavern data", () => {
  beforeEach(() => queryClient.clear());
  afterEach(() => vi.unstubAllGlobals());

  it("marks a song played when opened", async () => {
    const fetchMock = serve();
    renderLibrary();
    await userEvent.click(await screen.findByRole("button", { name: /Wiege/ }));
    await waitFor(() => expect(puts(fetchMock)).toHaveLength(1));
    expect(puts(fetchMock)[0]).toMatchObject({ url: expect.stringContaining("uebung%3Aa"), body: { played: true } });
  });

  it("shows stars and last played on the song card", async () => {
    serve({ meta: { "uebung:a": { stars: 3, lastPlayedAt: Date.now(), tags: [] } } });
    renderLibrary();
    const card = await screen.findByRole("button", { name: /Wiege/ });
    await waitFor(() => expect(within(card).getByLabelText("3 von 5 Sternen")).toHaveTextContent("★★★☆☆"));
    expect(within(card).getByText("Zuletzt gespielt: heute")).toBeInTheDocument();
  });

  it("sets stars in the open song", async () => {
    const fetchMock = serve();
    renderLibrary();
    await userEvent.click(await screen.findByRole("button", { name: /Wiege/ }));
    const group = await screen.findByRole("group", { name: "Beherrschung" });
    await userEvent.click(within(group).getByRole("button", { name: "4 Sterne" }));
    await waitFor(() => expect(puts(fetchMock).some((p) => p.body.stars === 4)).toBe(true));
  });

  it("filters by technique", async () => {
    serve({ meta: { "uebung:a": { stars: 0, lastPlayedAt: null, tags: [technique.id] } } });
    renderLibrary();
    await screen.findByRole("button", { name: /Fluss/ });
    await screen.findByRole("button", { name: /Eigener/ });
    await userEvent.selectOptions(await screen.findByLabelText("Technik"), technique.id);
    expect(screen.getByRole("button", { name: /Wiege/ })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Fluss/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /Eigener/ })).toBeNull();
  });

  it("shows the songs when the meta request fails", async () => {
    serve({ metaFails: true });
    renderLibrary();
    const card = await screen.findByRole("button", { name: /Wiege/ });
    expect(within(card).queryByLabelText(/Sternen/)).toBeNull();
  });

  it("alerts when a star write fails", async () => {
    serve({ putFails: true });
    renderLibrary();
    await userEvent.click(await screen.findByRole("button", { name: /Wiege/ }));
    await userEvent.click(await screen.findByRole("button", { name: "2 Sterne" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/nicht gespeichert/);
  });
});
