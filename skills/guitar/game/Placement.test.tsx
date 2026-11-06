import type { GameState } from "@skills/core";
import { localDayKey } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import GameApp from "../widgets/GameApp.js";
import { gameContent } from "./api.js";

const base: GameState = {
  day: localDayKey(Date.now()),
  placed: false,
  targetSongId: null,
  xp: 0,
  level: 1,
  title: "Novice",
  xpIntoLevel: 0,
  xpForNext: 100,
  streak: 0,
  totalSeconds: 0,
  weekSeconds: 0,
  doneToday: [],
  levels: {},
  lessons: {},
  records: {},
  recentQuestIds: [],
  chosenLessons: [],
  today: null,
};

const progress = { record: vi.fn(), get: () => null, complete: vi.fn() };
const bundled = [{ id: "em-am-wiege", titel: "Zwei Akkorde, eine Wiege" }];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function serve(opts: { state?: Partial<GameState>; songs?: { id: number; title: string }[]; fail?: boolean } = {}) {
  let placed = false;
  const fetchMock = vi.fn(async (url: string) => {
    const u = String(url);
    if (u.endsWith("/placement")) {
      if (opts.fail) return json({ error: { code: "x", message: "Speichern kaputt" } }, 500);
      placed = true;
      return json({ ok: true });
    }
    if (u.includes("/state")) return json({ ...base, ...opts.state, ...(placed ? { placed } : {}) });
    if (u.startsWith("/api/songs")) return json({ songs: opts.songs ?? [] });
    if (u.startsWith("/api/progress")) return json({ lessons: [] });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function placementBody(fetchMock: ReturnType<typeof serve>) {
  const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/placement"));
  return call ? JSON.parse(String((call[1] as RequestInit).body)) : undefined;
}

function renderPlacement(data: unknown[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/vollbild/guitar/spiel/einstufung"]}>
        <Routes>
          <Route
            path="/vollbild/:skillId/:moduleId/*"
            element={<GameApp data={data} progress={progress} settings={{}} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

async function toSongStep() {
  await userEvent.click(await screen.findByRole("button", { name: "Weiter" }));
  await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
}

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});
afterEach(() => vi.unstubAllGlobals());

describe("Placement", () => {
  it("posts known lessons, levels and target song", async () => {
    const fetchMock = serve({ songs: [{ id: 7, title: "Wonderwall" }] });
    renderPlacement([bundled]);
    expect(await screen.findByRole("heading", { name: "Was kannst du schon?" })).toBeInTheDocument();
    const listed = gameContent.nodes.filter((n) => n.available || n.knownSong);
    expect(screen.getAllByRole("checkbox")).toHaveLength(listed.length);
    await userEvent.click(screen.getByRole("checkbox", { name: "Haltung" }));
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("heading", { name: "Wie sicher fühlst du dich?" })).toBeInTheDocument();
    const tech = gameContent.techniques[0]!;
    const slider = screen.getByRole("slider", { name: tech.title });
    expect(slider).toHaveValue("3");
    fireEvent.change(slider, { target: { value: "5" } });
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("heading", { name: "Welchen Song willst du als Nächstes schaffen?" })).toBeInTheDocument();
    const radios = screen.getAllByRole("radio").map((r) => (r as HTMLInputElement).value);
    expect(radios).toEqual(["db:7", "uebung:em-am-wiege", ""]);
    await userEvent.click(screen.getByRole("radio", { name: /Zwei Akkorde, eine Wiege/ }));
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await screen.findByRole("heading", { name: "Quest Board" });
    const body = placementBody(fetchMock);
    expect(body.knownLessonIds).toEqual(["01-haltung"]);
    expect(body.levels[tech.id]).toBe(5);
    expect(body.levels[gameContent.techniques[1]!.id]).toBe(3);
    expect(body.targetSongId).toBe("uebung:em-am-wiege");
  });

  it("lists known songs in the placement and saves them", async () => {
    const fetchMock = serve();
    renderPlacement();
    const heading = await screen.findByRole("heading", { name: "Songs, die du schon spielst" });
    const songs = gameContent.nodes.filter((n) => n.knownSong);
    expect(songs.length).toBeGreaterThan(0);
    const list = heading.nextElementSibling as HTMLElement;
    for (const song of songs) expect(within(list).getByRole("checkbox", { name: song.title })).toBeInTheDocument();
    expect(screen.getAllByRole("checkbox").findIndex((box) => list.contains(box))).toBe(
      gameContent.nodes.filter((n) => n.available && !n.knownSong && !n.quick).length,
    );
    await userEvent.click(within(list).getByRole("checkbox", { name: songs[0]!.title }));
    await toSongStep();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await screen.findByRole("heading", { name: "Quest Board" });
    expect(placementBody(fetchMock).knownLessonIds).toEqual([songs[0]!.id]);
  });

  it("asks to tick Akkordwechsel only when changes are already fluent", async () => {
    serve();
    renderPlacement();
    expect(await screen.findByText(/„Akkordwechsel“ nur an, wenn .* flüssig/)).toBeInTheDocument();
  });

  it("works with no songs at all", async () => {
    const fetchMock = serve();
    renderPlacement();
    await toSongStep();
    expect(screen.getByRole("radio", { name: "Noch keinen" })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await screen.findByRole("heading", { name: "Quest Board" });
    expect(placementBody(fetchMock).targetSongId).toBeNull();
  });

  it("preselects The Bard's Song when it is imported", async () => {
    const fetchMock = serve({ songs: [{ id: 1, title: "Other" }, { id: 9, title: "The Bard's Song" }] });
    renderPlacement();
    await toSongStep();
    expect(screen.getByRole("radio", { name: /The Bard's Song/ })).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    await screen.findByRole("heading", { name: "Quest Board" });
    expect(placementBody(fetchMock).targetSongId).toBe("db:9");
  });

  it("keeps the dialog and shows the error when saving fails", async () => {
    serve({ fail: true });
    renderPlacement();
    await toSongStep();
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Speichern kaputt");
    expect(screen.getByRole("heading", { name: "Welchen Song willst du als Nächstes schaffen?" })).toBeInTheDocument();
  });

  it("preloads the current values when re-run", async () => {
    const tech = gameContent.techniques[0]!;
    const fetchMock = serve({
      state: {
        placed: true,
        lessons: { "02-anschlag": "gelernt", "01-haltung": "offen" },
        levels: { [tech.id]: 7 },
        targetSongId: "uebung:em-am-wiege",
      },
    });
    renderPlacement([bundled]);
    expect(await screen.findByRole("checkbox", { name: /Anschlag/ })).toBeChecked();
    expect(screen.getByRole("checkbox", { name: "Haltung" })).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("slider", { name: tech.title })).toHaveValue("7");
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByRole("radio", { name: /Zwei Akkorde, eine Wiege/ })).toBeChecked();
    void fetchMock;
  });
});
