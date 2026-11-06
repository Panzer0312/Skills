import { buildDailyQuests, type GameState } from "@skills/core";
import { focusManager, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import GameApp from "../widgets/GameApp.js";
import { gameContent } from "./api.js";

vi.mock("./ChordTrainer.js", async (original) => ({
  ...(await original<typeof import("./ChordTrainer.js")>()),
  ChordTrainer: ({ pair, onResult }: { pair?: [string, string]; onResult?: (n: number) => void }) => (
    <button type="button" onClick={() => onResult?.(23)}>
      Trainer {pair?.join("-")}
    </button>
  ),
}));

const ACTIVE = "game.activeQuest";

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
  chosenLessons: [],
  today: null,
};

const progress = { record: vi.fn(), get: () => null, complete: vi.fn() };

function quest(id: string) {
  const found = gameContent.quests.find((q) => q.id === id);
  if (!found) throw new Error(`no quest ${id}`);
  return found;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

interface Options {
  log?: () => Response | Promise<Response>;
  today?: () => Response | undefined | Promise<Response | undefined>;
  level?: () => Response | Promise<Response>;
  songs?: unknown[];
}

function serve(initial: Partial<GameState>, options: Options = {}) {
  let state: GameState = { ...base, ...initial };
  const fetchMock = vi.fn(async (input: string, init?: RequestInit) => {
    const url = String(input);
    const method = init?.method ?? "GET";
    if (url.endsWith("/state")) return json(state);
    if (url.endsWith("/today") && method === "PUT") {
      const response = await options.today?.();
      if (response) return response;
      state = { ...state, today: JSON.parse(String(init?.body)) as GameState["today"] };
      return json({ ok: true });
    }
    if (url.endsWith("/log")) {
      return options.log?.() ?? json({ xpGained: 40, suggestion: null, isRecord: false });
    }
    if (url.includes("/level/")) return options.level?.() ?? json({ ok: true });
    if (url.startsWith("/api/progress")) return json({ lessons: [] });
    if (url.startsWith("/api/songs")) return json({ songs: options.songs ?? [] });
    if (url.startsWith("/api/chords")) return json({ global: [], song: [], entries: [] });
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function writes(fetchMock: ReturnType<typeof serve>, path: string) {
  return fetchMock.mock.calls
    .filter(([url, init]) => String(url).endsWith(path) && init?.method !== undefined && init.method !== "GET")
    .map(([, init]) => JSON.parse(String(init?.body)) as Record<string, unknown>);
}

function held() {
  let release: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

function renderGame(path = "", data: unknown[] = []) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/vollbild/guitar/spiel${path}`]}>
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

function startedMinutesAgo(questId: string, minutes: number) {
  sessionStorage.setItem(ACTIVE, JSON.stringify({ questId, startedAt: Date.now() - minutes * 60_000 }));
}

async function finish() {
  await userEvent.click(await screen.findByRole("button", { name: "Fertig" }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  sessionStorage.clear();
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});
afterEach(() => vi.unstubAllGlobals());

describe("Quest Board", () => {
  const set = { minutes: 30, questIds: ["haltung-check", "wechsel-minute"] };

  it("builds and saves today's set once", async () => {
    const fetchMock = serve({});
    renderGame("/quests");
    const expected = buildDailyQuests({
      minutes: 30,
      content: gameContent,
      statuses: {},
      hasTargetSong: false,
      recentQuestIds: [],
      chosenLessonIds: [],
    });
    expect(await screen.findByRole("link", { name: new RegExp(quest(expected[0]!).title) })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: expected }]);
    expect(screen.getByRole("button", { name: "30 min" })).toHaveAttribute("aria-pressed", "true");
  });

  it("does not rebuild a saved set on reload", async () => {
    const fetchMock = serve({ today: set });
    renderGame("/quests");
    expect(await screen.findByRole("link", { name: /Haltungs-Check/ })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([]);
  });

  it("rebuilds a saved set without any known quest", async () => {
    const fetchMock = serve({ today: { minutes: 20, questIds: ["gibt-es-nicht"] } });
    renderGame("/quests");
    await waitFor(() => expect(writes(fetchMock, "/today")).toHaveLength(1));
    const saved = writes(fetchMock, "/today")[0]!;
    expect(saved.minutes).toBe(20);
    expect(saved.questIds).not.toContain("gibt-es-nicht");
  });

  it("rebuilds when the session length changes", async () => {
    const fetchMock = serve({ today: set });
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("button", { name: "10 min" }));
    await waitFor(() => expect(writes(fetchMock, "/today")).toHaveLength(1));
    expect(writes(fetchMock, "/today")[0]).toEqual({
      minutes: 10,
      questIds: buildDailyQuests({
        minutes: 10,
        content: gameContent,
        statuses: {},
        hasTargetSong: false,
        recentQuestIds: [],
        chosenLessonIds: [],
      }),
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "10 min" })).toHaveAttribute("aria-pressed", "true"));
  });

  it("includes chosen lessons in a fresh set", async () => {
    const fetchMock = serve({ chosenLessons: ["10-barre"] });
    renderGame("/quests");
    const expected = buildDailyQuests({
      minutes: 30,
      content: gameContent,
      statuses: {},
      hasTargetSong: false,
      recentQuestIds: [],
      chosenLessonIds: ["10-barre"],
    });
    expect(expected).toContain("barre-greifen");
    await waitFor(() => expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: expected }]));
  });

  it("does not rebuild today's set when a lesson is taken", async () => {
    const fetchMock = serve({ today: set, chosenLessons: ["10-barre"] });
    renderGame("/quests");
    const side = (await screen.findByRole("heading", { name: "Nebenwege" })).closest("div")!;
    expect(side).toHaveTextContent("Barré");
    expect(side).toHaveTextContent("Morgen dabei");
    expect(screen.queryByRole("link", { name: /Barré-Akkorde greifen/ })).not.toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([]);
  });

  it("promises Morgen dabei only for a quest that fits tomorrow's set", async () => {
    // 5 + 5 for road and drill, 15 fits the default 30 minutes, the next 15 does not.
    serve({ today: set, chosenLessons: ["song-bards-vorbereitung", "metal-erster-riff"] });
    renderGame("/quests");
    const side = (await screen.findByRole("heading", { name: "Nebenwege" })).closest("div")!;
    const [fits, tooLong] = within(side).getAllByRole("listitem");
    expect(fits).toHaveTextContent("Morgen dabei");
    expect(tooLong).not.toHaveTextContent("Morgen dabei");
    expect(within(tooLong!).getByRole("button", { name: /heute dazunehmen/ })).toBeInTheDocument();
  });

  it("keeps the main-road lesson out of the Nebenwege", async () => {
    serve({ today: set, chosenLessons: ["01-haltung", "10-barre"] });
    renderGame("/quests");
    const side = (await screen.findByRole("heading", { name: "Nebenwege" })).closest("div")!;
    expect(within(side).getAllByRole("listitem")).toHaveLength(1);
    expect(side).toHaveTextContent("Barré");
  });

  it("shows no Nebenwege when only the main-road lesson is chosen", async () => {
    serve({ today: set, chosenLessons: ["01-haltung"] });
    renderGame("/quests");
    await screen.findByText("Bester nächster Schritt");
    expect(screen.queryByRole("heading", { name: "Nebenwege" })).not.toBeInTheDocument();
  });

  it("appends a chosen lesson's quest with Heute dazunehmen", async () => {
    const fetchMock = serve({ today: set, chosenLessons: ["10-barre"] });
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("button", { name: /heute dazunehmen/ }));
    await waitFor(() =>
      expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: [...set.questIds, "barre-greifen"] }]),
    );
    await waitFor(() => expect(screen.queryByRole("button", { name: /heute dazunehmen/ })).not.toBeInTheDocument());
  });

  it("blocks board writes while the village build runs", async () => {
    const response = held();
    serve({}, { today: () => response.promise });
    renderGame();
    await userEvent.click(await screen.findByRole("link", { name: /Quest Board/ }));
    await screen.findByRole("heading", { name: "Quest Board" });
    expect(screen.getByRole("button", { name: "10 min" })).toBeDisabled();
    response.release(json({ ok: true }));
    await waitFor(() => expect(screen.getByRole("button", { name: "10 min" })).toBeEnabled());
  });

  it("links a board row to its map node", async () => {
    serve({ today: set });
    renderGame("/quests");
    const row = (await screen.findByRole("link", { name: /Haltungs-Check/ })).closest("li")!;
    expect(within(row).getByRole("link", { name: "Auf der Karte" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/hafen/01-haltung",
    );
  });

  it("shows an error and retries when the set cannot be saved", async () => {
    let failing = true;
    const fetchMock = serve({}, { today: () => (failing ? json({ error: { message: "kaputt" } }, 500) : undefined) });
    renderGame("/quests");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toHaveLength(1);
    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Erneut versuchen" }));
    await waitFor(() => expect(writes(fetchMock, "/today")).toHaveLength(2));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
  });

  it("shows the best next step with its reason", async () => {
    const [first, second] = gameContent.road;
    serve({ today: set, lessons: { [first!.lessonId]: "gelernt" } });
    renderGame("/quests");
    expect(await screen.findByText(second!.reason)).toBeInTheDocument();
    expect(screen.getByText("Bester nächster Schritt")).toBeInTheDocument();
  });

  it("names the change drill and promises more while planned steps remain", async () => {
    const written = gameContent.road.filter((step) => step.questId !== null);
    const lessons = Object.fromEntries(written.map((step) => [step.lessonId, "gelernt" as const]));
    serve({ today: set, lessons });
    renderGame("/quests");
    const block = (await screen.findByText("Bester nächster Schritt")).closest("div")!;
    expect(block).toHaveTextContent("Wechsel pro Minute");
    expect(block).toHaveTextContent("Alle fertigen Lektionen auf dem Hauptweg sind geschafft. Weitere folgen.");
    expect(block).not.toHaveTextContent("Der Hauptweg ist geschafft");
  });

  it("keeps the finished message for a truly finished road", async () => {
    const road = gameContent.road;
    gameContent.road = road.filter((step) => step.questId !== null);
    try {
      const lessons = Object.fromEntries(gameContent.road.map((step) => [step.lessonId, "gelernt" as const]));
      serve({ today: set, lessons });
      renderGame("/quests");
      const block = (await screen.findByText("Bester nächster Schritt")).closest("div")!;
      expect(block).toHaveTextContent("Wechsel pro Minute");
      expect(block).toHaveTextContent("Der Hauptweg ist geschafft.");
      expect(block).not.toHaveTextContent("Weitere folgen");
    } finally {
      gameContent.road = road;
    }
  });

  it("starts the best next quest without a write when it is in today's set", async () => {
    const fetchMock = serve({ today: { minutes: 30, questIds: ["haltung-check", "wechsel-minute"] } });
    renderGame("/quests");
    const start = await screen.findByRole("link", { name: "Quest starten" });
    expect(start).toHaveAttribute("href", "/vollbild/guitar/spiel/quest/haltung-check");
    await userEvent.click(start);
    expect(await screen.findByRole("button", { name: "Fertig" })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([]);
  });

  it("adds a missing best next quest to today's set before starting it", async () => {
    const fetchMock = serve({ today: { minutes: 20, questIds: ["wechsel-minute"] } });
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("link", { name: "Quest starten" }));
    expect(await screen.findByRole("button", { name: "Fertig" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Haltungs-Check" })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([{ minutes: 20, questIds: ["wechsel-minute", "haltung-check"] }]);
  });

  it("stays on the board when adding the best next quest fails", async () => {
    serve(
      { today: { minutes: 20, questIds: ["wechsel-minute"] } },
      { today: () => json({ error: { message: "kaputt" } }, 500) },
    );
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("link", { name: "Quest starten" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("kaputt");
    expect(screen.getByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
  });

  it("links to the checkpoint when the next lesson is being practised", async () => {
    const [first] = gameContent.road;
    serve({ today: set, lessons: { [first!.lessonId]: "aktiv" } });
    renderGame("/quests");
    expect(await screen.findByRole("link", { name: "Checkpoint bestätigen" })).toHaveAttribute(
      "href",
      `/vollbild/guitar/spiel/bibliothek/${first!.lessonId}`,
    );
  });

  it("shows no checkpoint link before a quest of the next lesson", async () => {
    serve({ today: set });
    renderGame("/quests");
    await screen.findByText("Bester nächster Schritt");
    expect(screen.queryByRole("link", { name: "Checkpoint bestätigen" })).not.toBeInTheDocument();
  });

  it("rebuilds past midnight after the window gets focus again", async () => {
    // The app's own defaults: a focus refetch must not depend on them.
    queryClient.setDefaultOptions({ queries: { retry: false, staleTime: 30_000, refetchOnWindowFocus: false } });
    const before = serve({});
    renderGame("/quests");
    await waitFor(() => expect(writes(before, "/today")).toHaveLength(1));
    await screen.findByRole("link", { name: /Haltungs-Check/ });

    const after = serve({ today: null });
    act(() => {
      focusManager.setFocused(false);
      focusManager.setFocused(true);
    });
    await waitFor(() => expect(writes(after, "/today")).toHaveLength(1));
    focusManager.setFocused(undefined);
  });

  it("shows minutes, the level as ten dots and the done mark", async () => {
    serve({ today: set, levels: { akkordwechsel: 7 }, doneToday: ["wechsel-minute"] });
    renderGame("/quests");
    const row = (await screen.findByRole("link", { name: /Wechsel pro Minute/ })).closest("li")!;
    expect(row).toHaveTextContent("5 min");
    expect(row).toHaveTextContent("erledigt");
    const dots = within(row).getByRole("img", { name: "Stufe 7 von 10" });
    expect(dots.querySelectorAll("i")).toHaveLength(10);
    expect(dots.querySelectorAll("i.on")).toHaveLength(7);
    const other = screen.getByRole("link", { name: /Haltungs-Check/ }).closest("li")!;
    expect(other).not.toHaveTextContent("erledigt");
    expect(within(other).getByRole("img", { name: "Stufe 3 von 10" })).toBeInTheDocument();
  });

  it("removes a row", async () => {
    const fetchMock = serve({ today: set });
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("button", { name: "Haltungs-Check entfernen" }));
    await waitFor(() =>
      expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: ["wechsel-minute"] }]),
    );
    await waitFor(() => expect(screen.queryByRole("link", { name: /Haltungs-Check/ })).not.toBeInTheDocument());
  });

  it("keeps the last row, an empty set would rebuild itself", async () => {
    serve({ today: { minutes: 30, questIds: ["haltung-check"] } });
    renderGame("/quests");
    expect(await screen.findByRole("button", { name: "Haltungs-Check entfernen" })).toBeDisabled();
  });

  it("offers the other quests in the add list", async () => {
    const fetchMock = serve({ today: set });
    renderGame("/quests");
    await userEvent.click(await screen.findByText("Quest hinzufügen"));
    expect(screen.queryByRole("button", { name: "Haltungs-Check hinzufügen" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Pentatonik Box 1 hinzufügen" }));
    await waitFor(() =>
      expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: [...set.questIds, "pentatonik-box1"] }]),
    );
  });

  it("lets the owner change a level with the slider", async () => {
    const fetchMock = serve({ today: set, levels: { akkordwechsel: 4 } });
    renderGame("/quests");
    await userEvent.click(await screen.findByRole("button", { name: "Stufe von Wechsel pro Minute ändern" }));
    const slider = screen.getByRole("slider", { name: "Stufe" });
    expect(slider).toHaveValue("4");
    fireEvent.change(slider, { target: { value: "6" } });
    await userEvent.click(screen.getByRole("button", { name: "Stufe speichern" }));
    await waitFor(() => expect(writes(fetchMock, "/level/akkordwechsel")).toEqual([{ level: 6 }]));
    await waitFor(() => expect(screen.queryByRole("slider")).not.toBeInTheDocument());
  });
});

describe("village panel", () => {
  const expected = () =>
    buildDailyQuests({ minutes: 30, content: gameContent, statuses: {}, hasTargetSong: false, recentQuestIds: [], chosenLessonIds: [] });

  it("builds today's set on the first visit, one click from a quest", async () => {
    const fetchMock = serve({});
    renderGame();
    const first = quest(expected()[0]!);
    await userEvent.click(await screen.findByRole("link", { name: new RegExp(first.title) }));
    expect(await screen.findByRole("heading", { name: first.title })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([{ minutes: 30, questIds: expected() }]);
  });

  it("rebuilds a saved set without any known quest", async () => {
    const fetchMock = serve({ today: { minutes: 30, questIds: ["gibt-es-nicht"] } });
    renderGame();
    expect(await screen.findByRole("link", { name: new RegExp(quest(expected()[0]!).title) })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toHaveLength(1);
  });

  it("does not rebuild a saved set", async () => {
    const fetchMock = serve({ today: { minutes: 20, questIds: ["haltung-check"] } });
    renderGame();
    expect(await screen.findByRole("link", { name: /Haltungs-Check/ })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([]);
  });

  it("waits for a finished fetch before it builds", async () => {
    queryClient.setQueryData(["game", "guitar"], { ...base, today: null });
    const fetchMock = serve({ today: { minutes: 20, questIds: ["haltung-check"] } });
    renderGame();
    expect(await screen.findByRole("link", { name: /Haltungs-Check/ })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toEqual([]);
  });

  it("builds once when the owner walks to the board during the build", async () => {
    const response = held();
    let holding = true;
    const fetchMock = serve(
      {},
      {
        today: async () => {
          if (!holding) return undefined;
          holding = false;
          await response.promise;
          return undefined;
        },
      },
    );
    renderGame();
    await waitFor(() => expect(writes(fetchMock, "/today")).toHaveLength(1));
    await userEvent.click(screen.getByRole("link", { name: /Quest Board/ }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toHaveLength(1);
    response.release(json({ ok: true }));
    expect(await screen.findByRole("link", { name: new RegExp(quest(expected()[0]!).title) })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toHaveLength(1);
  });

  it("falls back to the board link when the set cannot be saved", async () => {
    const fetchMock = serve({}, { today: () => json({ error: { message: "kaputt" } }, 500) });
    renderGame();
    expect(await screen.findByRole("link", { name: /Heutige Quests zusammenstellen/ })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/quests",
    );
    expect(screen.getByRole("alert")).toHaveTextContent("kaputt");
    expect(screen.getByRole("heading", { name: "Heute" })).toBeInTheDocument();
    expect(writes(fetchMock, "/today")).toHaveLength(1);
  });
});

describe("quest view", () => {
  it("scales the quest with the personal level", async () => {
    serve({ levels: { anschlag: 10 } });
    renderGame("/quest/anschlag-takt");
    expect(await screen.findByRole("heading", { name: "Gleichmäßiger Anschlag" })).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole("slider", { name: "BPM" })).toHaveValue("80"));
    expect(screen.getByText("80 BPM", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByText("Stufe 10 von 10")).toBeInTheDocument();
  });

  it("uses level 3 for a technique without a stored level", async () => {
    const fetchMock = serve({});
    renderGame("/quest/anschlag-takt");
    expect(await screen.findByText("Stufe 3 von 10")).toBeInTheDocument();
    expect(screen.getByText("49 BPM", { selector: "li" })).toBeInTheDocument();
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(writes(fetchMock, "/log")).toHaveLength(1));
    expect(writes(fetchMock, "/log")[0]).toMatchObject({
      kind: "quest",
      questId: "anschlag-takt",
      lessonId: "02-anschlag",
      techniqueId: "anschlag",
      level: 3,
      rating: "passt",
    });
    expect(writes(fetchMock, "/log")[0]).not.toHaveProperty("metricKey");
    expect(writes(fetchMock, "/log")[0]).not.toHaveProperty("metricValue");
  });

  it("links to the lesson", async () => {
    serve({});
    renderGame("/quest/anschlag-takt");
    expect(await screen.findByRole("link", { name: "Lektion lesen" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/bibliothek/02-anschlag",
    );
  });

  it("embeds the trainer with the scaled pair and fills the dialog from it", async () => {
    const fetchMock = serve({ levels: { akkordwechsel: 10 } });
    renderGame("/quest/wechsel-minute");
    await userEvent.click(await screen.findByRole("button", { name: "Trainer D-Am" }));
    await finish();
    expect(screen.getByLabelText("Wechsel pro Minute")).toHaveValue(23);
    await userEvent.click(screen.getByRole("button", { name: "Zu leicht" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(writes(fetchMock, "/log")).toHaveLength(1));
    expect(writes(fetchMock, "/log")[0]).toMatchObject({
      level: 10,
      rating: "zu-leicht",
      metricKey: "wechsel:Am-D",
      metricValue: 23,
      masteryTarget: 40,
    });
  });

  it("starts the timer and resumes it after a reload", async () => {
    serve({});
    const first = renderGame("/quest/anschlag-takt");
    await screen.findByRole("timer");
    const stored = JSON.parse(sessionStorage.getItem(ACTIVE)!) as { questId: string; startedAt: number };
    expect(stored.questId).toBe("anschlag-takt");
    first.unmount();

    startedMinutesAgo("anschlag-takt", 12);
    renderGame("/quest/anschlag-takt");
    expect(await screen.findByRole("timer")).toHaveTextContent(/^12:0\d$/);
  });

  it("starts fresh when another quest was active", async () => {
    serve({});
    startedMinutesAgo("haltung-check", 12);
    renderGame("/quest/anschlag-takt");
    expect(await screen.findByRole("timer")).toHaveTextContent(/^0:0\d$/);
    expect((JSON.parse(sessionStorage.getItem(ACTIVE)!) as { questId: string }).questId).toBe("anschlag-takt");
  });

  it("clears the timer and logs nothing on Abbrechen", async () => {
    const fetchMock = serve({ today: { minutes: 30, questIds: ["anschlag-takt"] } });
    renderGame("/quest/anschlag-takt");
    await userEvent.click(await screen.findByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
    expect(sessionStorage.getItem(ACTIVE)).toBeNull();
    expect(writes(fetchMock, "/log")).toEqual([]);
  });

  it("offers a link to the placement for a song quest without a song", async () => {
    serve({ targetSongId: null });
    renderGame("/quest/song-ziel");
    expect(await screen.findByRole("link", { name: /Zielsong wählen/ })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/einstufung",
    );
    expect(screen.queryByRole("link", { name: /Taverne/ })).not.toBeInTheDocument();
  });

  it("shows a shipped target song with tavern link and tempo", async () => {
    serve({ targetSongId: "uebung:wiege", levels: { song: 10 } });
    renderGame("/quest/song-ziel", [[{ id: "wiege", titel: "Eine Wiege" }]]);
    expect(await screen.findByText("Eine Wiege")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Taverne/ })).toHaveAttribute("href", "/vollbild/guitar/spiel/taverne");
    expect(screen.getByText("Abschnitt: Ganzer Song · 5 Durchläufe · 100 % Tempo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Lektion lesen" })).not.toBeInTheDocument();
  });

  it("shows the lesson's own song, not the target song", async () => {
    serve(
      { targetSongId: "db:2", levels: { song: 6 } },
      {
        songs: [
          { id: 2, title: "Creep" },
          { id: 7, title: "The Bard's Song" },
        ],
      },
    );
    renderGame("/quest/bards-ganz");
    expect(await screen.findByText("The Bard's Song")).toBeInTheDocument();
    expect(screen.queryByText("Creep")).not.toBeInTheDocument();
    expect(screen.getByText("Abschnitt: Ganzer Song · 3 Durchläufe · 67 % Tempo")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: /Taverne/ })).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Importiere den Song/ })).not.toBeInTheDocument();
  });

  it("offers the import when the lesson's song is missing, and keeps the plan", async () => {
    serve({ targetSongId: null, levels: { song: 3 } }, { songs: [{ id: 2, title: "Creep" }] });
    renderGame("/quest/bards-ganz");
    expect(await screen.findByRole("link", { name: /Importiere den Song/ })).toHaveAttribute("href", "/songs/neu");
    expect(screen.getByText("The Bard's Song")).toBeInTheDocument();
    expect(screen.getByText("Abschnitt: Teil A · 2 Durchläufe · 57 % Tempo")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Zielsong wählen/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Taverne/ })).not.toBeInTheDocument();
  });

  it("says so when the songs cannot be loaded for a lesson's song", async () => {
    serve({});
    const fetchMock = vi.mocked(fetch);
    const answer = fetchMock.getMockImplementation()!;
    fetchMock.mockImplementation(async (input, init) =>
      String(input).startsWith("/api/songs")
        ? json({ error: { message: "kaputt" } }, 500)
        : answer(input as string, init),
    );
    renderGame("/quest/bards-ganz");
    expect(await screen.findByRole("alert")).toHaveTextContent("Deine Songs konnten nicht geladen werden.");
    expect(screen.getByText("The Bard's Song")).toBeInTheDocument();
  });

  it("shows section, runs and tempo on a song quest", async () => {
    serve({ targetSongId: "uebung:wiege", levels: { song: 5 } });
    renderGame("/quest/song-ziel", [[{ id: "wiege", titel: "Eine Wiege" }]]);
    expect(await screen.findByText("Abschnitt: Refrain · 3 Durchläufe · 72 % Tempo")).toBeInTheDocument();
  });

  it("resolves an imported target song", async () => {
    serve({ targetSongId: "db:7" }, { songs: [{ id: 7, title: "Eigenes Lied" }] });
    renderGame("/quest/song-ziel");
    expect(await screen.findByText("Eigenes Lied")).toBeInTheDocument();
  });
});

describe("result dialog", () => {
  async function saveResult() {
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await screen.findByText("+40 XP");
  }

  it("sends the lesson's target from a quest without its own", async () => {
    const fetchMock = serve({});
    renderGame("/quest/akkordwechsel-takt");
    await saveResult();
    expect(writes(fetchMock, "/log")[0]).toMatchObject({ lessonId: "07-akkordwechsel", masteryTarget: 40 });
  });

  it("sends quick for a quick-win quest", async () => {
    const node = gameContent.nodes.find((n) => n.id === "02-anschlag")!;
    node.quick = true;
    try {
      const fetchMock = serve({});
      renderGame("/quest/anschlag-takt");
      await saveResult();
      expect(writes(fetchMock, "/log")[0]).toMatchObject({ quick: true });
    } finally {
      node.quick = false;
    }
  });

  it("sends no quick flag for other quests", async () => {
    const fetchMock = serve({});
    renderGame("/quest/anschlag-takt");
    await saveResult();
    expect(writes(fetchMock, "/log")[0]).not.toHaveProperty("quick");
  });

  it("sends no target for a lesson without a metric", async () => {
    const fetchMock = serve({});
    renderGame("/quest/anschlag-takt");
    await saveResult();
    expect(writes(fetchMock, "/log")[0]).not.toHaveProperty("masteryTarget");
  });

  it("links to the checkpoint when the quest's lesson is the best next step", async () => {
    serve({ lessons: Object.fromEntries(gameContent.road.slice(0, 6).map((s) => [s.lessonId, "gelernt" as const])) });
    renderGame("/quest/akkordwechsel-takt");
    await saveResult();
    expect(screen.getByRole("link", { name: "Checkpoint bestätigen" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/bibliothek/07-akkordwechsel",
    );
  });

  it("shows no checkpoint link for another lesson or a song", async () => {
    serve({});
    const first = renderGame("/quest/anschlag-takt");
    await saveResult();
    expect(screen.queryByRole("link", { name: "Checkpoint bestätigen" })).not.toBeInTheDocument();
    first.unmount();
    renderGame("/quest/song-ziel");
    await saveResult();
    expect(screen.queryByRole("link", { name: "Checkpoint bestätigen" })).not.toBeInTheDocument();
  });

  it("caps prefilled minutes at three times the plan", async () => {
    serve({});
    startedMinutesAgo("anschlag-takt", 40);
    renderGame("/quest/anschlag-takt");
    await finish();
    expect(screen.getByLabelText("Geübte Minuten")).toHaveValue(15);
  });

  it("prefills the elapsed minutes below the cap", async () => {
    serve({});
    startedMinutesAgo("anschlag-takt", 7);
    renderGame("/quest/anschlag-takt");
    await finish();
    expect(screen.getByLabelText("Geübte Minuten")).toHaveValue(7);
    expect(screen.queryByLabelText("Wechsel pro Minute")).not.toBeInTheDocument();
  });

  it("prefills at least one minute", async () => {
    serve({});
    renderGame("/quest/anschlag-takt");
    await finish();
    expect(screen.getByLabelText("Geübte Minuten")).toHaveValue(1);
  });

  it("refuses zero minutes and leaves Abbrechen as the exit", async () => {
    const fetchMock = serve({ today: { minutes: 30, questIds: ["anschlag-takt"] } });
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    const minutes = screen.getByLabelText("Geübte Minuten");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "0");
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("von 1 bis 240");
    expect(writes(fetchMock, "/log")).toEqual([]);
    await userEvent.click(screen.getByRole("button", { name: "Abbrechen" }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
    expect(sessionStorage.getItem(ACTIVE)).toBeNull();
    expect(writes(fetchMock, "/log")).toEqual([]);
  });

  it("logs edited minutes, not the timer value", async () => {
    const fetchMock = serve({});
    startedMinutesAgo("anschlag-takt", 7);
    renderGame("/quest/anschlag-takt");
    await finish();
    const minutes = screen.getByLabelText("Geübte Minuten");
    await userEvent.clear(minutes);
    await userEvent.type(minutes, "4");
    await userEvent.click(screen.getByRole("button", { name: "Zu schwer" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await waitFor(() => expect(writes(fetchMock, "/log")).toHaveLength(1));
    expect(writes(fetchMock, "/log")[0]).toMatchObject({ seconds: 240, rating: "zu-schwer" });
  });

  it("asks for a rating and valid minutes before saving", async () => {
    const fetchMock = serve({});
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Wähle/);
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    await userEvent.clear(screen.getByLabelText("Geübte Minuten"));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/Minuten/);
    expect(writes(fetchMock, "/log")).toEqual([]);
  });

  it("sends one log on a double click", async () => {
    const response = held();
    const fetchMock = serve({}, { log: () => response.promise });
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    const save = screen.getByRole("button", { name: "Speichern" });
    const form = save.closest("form")!;
    fireEvent.submit(form);
    fireEvent.submit(form);
    expect(writes(fetchMock, "/log")).toHaveLength(1);
    expect(save).toBeDisabled();
    response.release(json({ xpGained: 40, suggestion: null, isRecord: false }));
    expect(await screen.findByText("+40 XP")).toBeInTheDocument();
    expect(writes(fetchMock, "/log")).toHaveLength(1);
  });

  it("keeps the dialog open and retries after a server error", async () => {
    let failing = true;
    const fetchMock = serve(
      {},
      {
        log: () =>
          failing
            ? json({ error: { code: "x", message: "Server kaputt" } }, 500)
            : json({ xpGained: 25, suggestion: null, isRecord: false }),
      },
    );
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Server kaputt");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(sessionStorage.getItem(ACTIVE)).not.toBeNull();

    failing = false;
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("+25 XP")).toBeInTheDocument();
    expect(writes(fetchMock, "/log")).toHaveLength(2);
    expect(sessionStorage.getItem(ACTIVE)).toBeNull();
  });

  it("offers the suggested level and saves the owner's choice", async () => {
    const response = held();
    const fetchMock = serve(
      { levels: { anschlag: 4 }, today: { minutes: 30, questIds: ["anschlag-takt"] } },
      { log: () => json({ xpGained: 40, suggestion: 5, isRecord: false }), level: () => response.promise },
    );
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Zu leicht" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("Nächstes Mal Stufe 5?")).toBeInTheDocument();
    const slider = screen.getByRole("slider", { name: "Stufe" });
    expect(slider).toHaveValue("5");
    fireEvent.change(slider, { target: { value: "7" } });
    const save = screen.getByRole("button", { name: "Stufe speichern" });
    // One act keeps React from disabling the button between the clicks.
    act(() => {
      fireEvent.click(save);
      fireEvent.click(save);
    });
    expect(writes(fetchMock, "/level/anschlag")).toEqual([{ level: 7 }]);
    expect(save).toBeDisabled();
    response.release(json({ ok: true }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
    expect(writes(fetchMock, "/level/anschlag")).toEqual([{ level: 7 }]);
  });

  it("stays on the suggestion when the level cannot be saved", async () => {
    serve(
      {},
      {
        log: () => json({ xpGained: 40, suggestion: 2, isRecord: false }),
        level: () => json({ error: { code: "x", message: "Stufe kaputt" } }, 500),
      },
    );
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Zu schwer" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await userEvent.click(await screen.findByRole("button", { name: "Stufe speichern" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Stufe kaputt");
    expect(screen.getByText("Nächstes Mal Stufe 2?")).toBeInTheDocument();
  });

  it("saves nothing when the owner declines the suggestion", async () => {
    const fetchMock = serve(
      { today: { minutes: 30, questIds: ["anschlag-takt"] } },
      { log: () => json({ xpGained: 40, suggestion: 5, isRecord: false }) },
    );
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Zu leicht" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    await userEvent.click(await screen.findByRole("button", { name: "Zurück zum Board" }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
    expect(writes(fetchMock, "/level/anschlag")).toEqual([]);
  });

  it("goes back to the board without a suggestion", async () => {
    serve({ today: { minutes: 30, questIds: ["anschlag-takt"] } });
    renderGame("/quest/anschlag-takt");
    await finish();
    await userEvent.click(screen.getByRole("button", { name: "Passt" }));
    await userEvent.click(screen.getByRole("button", { name: "Speichern" }));
    expect(await screen.findByText("+40 XP")).toBeInTheDocument();
    expect(screen.queryByRole("slider", { name: "Stufe" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Zurück zum Board" }));
    expect(await screen.findByRole("heading", { name: "Quest Board" })).toBeInTheDocument();
  });
});
