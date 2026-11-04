import type { GameState } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import GameApp from "../widgets/GameApp.js";
import { gameApi, gameContent } from "./api.js";

const base: GameState = {
  placed: true,
  targetSongId: null,
  xp: 620,
  level: 3,
  title: "Squire of the Strings",
  xpIntoLevel: 320,
  xpForNext: 300,
  streak: 12,
  totalSeconds: 8100,
  weekSeconds: 3600,
  doneToday: [],
  levels: {},
  lessons: {},
  records: {},
  recentQuestIds: [],
  today: null,
};

const progress = { record: vi.fn(), get: () => null, complete: vi.fn() };

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function serve(state: Partial<GameState>) {
  const fetchMock = vi.fn(async (url: string) => {
    if (String(url).includes("/state")) return json({ ...base, ...state });
    if (String(url).startsWith("/api/progress")) return json({ lessons: [] });
    if (String(url).startsWith("/api/songs")) return json({ songs: [] });
    if (String(url).startsWith("/api/chords")) return json({ global: [], song: [], entries: [] });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderGame(path = "") {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/vollbild/guitar/spiel${path}`]}>
        <Routes>
          <Route
            path="/vollbild/:skillId/:moduleId/*"
            element={<GameApp data={[]} progress={progress} settings={{}} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});
afterEach(() => vi.unstubAllGlobals());

describe("GameShell", () => {
  it("sends an unplaced player to the placement from the village", async () => {
    serve({ placed: false });
    renderGame();
    expect(await screen.findByRole("heading", { name: "Einstufung" })).toBeInTheDocument();
  });

  it("sends an unplaced player to the placement from the quest screens", async () => {
    serve({ placed: false });
    const first = renderGame("/quests");
    expect(await screen.findByRole("heading", { name: "Einstufung" })).toBeInTheDocument();
    first.unmount();
    renderGame("/quest/haltung-check");
    expect(await screen.findByRole("heading", { name: "Einstufung" })).toBeInTheDocument();
  });

  it("lets an unplaced player open the tuner", async () => {
    serve({ placed: false });
    renderGame("/schrein");
    expect(await screen.findByRole("button", { name: /Stimmgerät starten/ })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Schrein" })).toBeInTheDocument();
  });

  it("keeps the tuner reachable when the server is down", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({}, 500)));
    renderGame("/schrein");
    expect(await screen.findByRole("button", { name: /Erneut versuchen/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Stimmgerät starten/ })).toBeInTheDocument();
  });

  it("shows level, title, streak and time in the status bar", async () => {
    serve({});
    renderGame();
    const bar = await screen.findByRole("banner");
    await within(bar).findByText(/Squire of the Strings/);
    expect(bar).toHaveTextContent("Level 3");
    expect(bar).toHaveTextContent("12");
    expect(bar).toHaveTextContent("2h 15m");
    expect(bar).toHaveTextContent("1h 0m");
    expect(within(bar).getByRole("link", { name: /Dorf/ })).toHaveAttribute("href", "/vollbild/guitar/spiel");
  });

  it("offers all five village places as links", async () => {
    serve({});
    renderGame();
    const places: [RegExp, string][] = [
      [/Quest Board/, "/quests"],
      [/Tavern/, "/taverne"],
      [/Library/, "/bibliothek"],
      [/Harbor/, "/hafen"],
      [/Market/, "/markt"],
    ];
    for (const [name, href] of places) {
      expect(await screen.findByRole("link", { name })).toHaveAttribute("href", `/vollbild/guitar/spiel${href}`);
    }
  });

  it("offers the compact menu below the village", async () => {
    serve({});
    renderGame();
    const places: [RegExp, string][] = [
      [/Shrine/, "/schrein"],
      [/Forge/, "/schmiede"],
      [/Griffbrett/, "/griffbrett"],
      [/Chronicle/, "/chronik"],
    ];
    for (const [name, href] of places) {
      expect(await screen.findByRole("link", { name })).toHaveAttribute("href", `/vollbild/guitar/spiel${href}`);
    }
  });

  it("starts today's quest with one click from the village", async () => {
    const quest = gameContent.quests[0]!;
    serve({ today: { minutes: 30, questIds: [quest.id] } });
    renderGame();
    await userEvent.click(await screen.findByRole("link", { name: new RegExp(quest.title) }));
    expect(await screen.findByRole("heading", { name: quest.title })).toBeInTheDocument();
  });

  it("marks a quest done today in the village", async () => {
    const quest = gameContent.quests[0]!;
    serve({ today: { minutes: 30, questIds: [quest.id] }, doneToday: [quest.id] });
    renderGame();
    expect(await screen.findByRole("link", { name: new RegExp(quest.title) })).toHaveTextContent("erledigt");
  });

  it("links to the Quest Board while today's set is not built", async () => {
    serve({ today: null });
    renderGame();
    expect(await screen.findByRole("link", { name: /Heutige Quests zusammenstellen/ })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/quests",
    );
  });

  it("shows an error with retry when the server is down", async () => {
    const down = vi.fn(async () => json({}, 500));
    vi.stubGlobal("fetch", down);
    renderGame();
    const retry = await screen.findByRole("button", { name: /Erneut versuchen/ });
    expect(screen.getByRole("alert")).toBeInTheDocument();
    serve({});
    await userEvent.click(retry);
    expect(await screen.findByRole("link", { name: /Tavern/ })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});

describe("game places", () => {
  it("opens a locked lesson in the library", async () => {
    serve({});
    renderGame("/bibliothek");
    const locked = await screen.findByRole("button", { name: /Saiten/ });
    expect(locked).toBeEnabled();
  });

  it("opens a lesson straight from its url", async () => {
    serve({});
    renderGame("/bibliothek/02-anschlag");
    expect(await screen.findByRole("button", { name: /Zurück zur Übersicht/ })).toBeInTheDocument();
  });

  it("links from the tavern to the song import", async () => {
    serve({});
    renderGame("/taverne");
    expect(await screen.findByRole("link", { name: /Song hinzufügen/ })).toHaveAttribute("href", "/songs/neu");
  });

  it("highlights the best next step in the harbor", async () => {
    const [first, second] = gameContent.road;
    serve({ lessons: { [first!.lessonId]: "gelernt" } });
    renderGame("/hafen");
    const current = await screen.findByText(second!.reason);
    expect(current.closest("li")).toHaveAttribute("aria-current", "step");
    expect(screen.getByText("Die Karte öffnet bald")).toBeInTheDocument();
  });

  it("promises the market", async () => {
    serve({});
    renderGame("/markt");
    expect(await screen.findByText("Der Markt öffnet bald")).toBeInTheDocument();
  });

  it("shows totals, records and the placement link in the chronicle", async () => {
    serve({ records: { "wechsel:Am-Em": 41 } });
    renderGame("/chronik");
    expect(await screen.findByText("2h 15m", { selector: "dd" })).toBeInTheDocument();
    expect(screen.getByText("Wechsel Am-Em")).toBeInTheDocument();
    expect(screen.getByText("41")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Einstufung wiederholen" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/einstufung",
    );
  });
});

describe("gameApi", () => {
  it("writes to the guitar routes and refreshes the state", async () => {
    const fetchMock = serve({});
    await queryClient.fetchQuery({ queryKey: ["game", "guitar"], queryFn: () => 1 });
    await gameApi.setLevel("barre", 4);
    await gameApi.setToday(20, ["a"]);
    await gameApi.log({ kind: "frei", seconds: 60, level: 1 });
    await gameApi.placement({ knownLessonIds: [], levels: {}, targetSongId: null });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      "/api/game/guitar/level/barre",
      "/api/game/guitar/today",
      "/api/game/guitar/log",
      "/api/game/guitar/placement",
    ]);
    await waitFor(() => expect(queryClient.getQueryState(["game", "guitar"])?.isInvalidated).toBe(true));
  });
});
