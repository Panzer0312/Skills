import type { GameState, LessonStatus, MapNode } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import GameApp from "../../widgets/GameApp.js";
import { gameApi, gameContent, normalizeTitle } from "../api.js";

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
  chosenLessons: [],
  records: {},
  recentQuestIds: [],
  today: null,
};

const progress = { record: vi.fn(), get: () => null, complete: vi.fn() };
const FIRST = "01-haltung";
const OTHER = "12-techniken";
const CHOSEN = ["09-powerchords", "11-pentatonik"];

const nodeOf = (id: string) => gameContent.nodes.find((node) => node.id === id)!;
const titleOf = (id: string) => nodeOf(id).title;
const planned = gameContent.nodes.find((node) => !node.available && !node.knownSong && node.techniqueId)!;
const quick = gameContent.nodes.find((node) => node.quick)!;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function serve(state: Partial<GameState>, songs: { id: number; title: string }[] = []) {
  const current = { ...base, ...state };
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    const path = String(url);
    if (path.includes("/state")) return json(current);
    if (path.startsWith("/api/progress")) return json({ lessons: [] });
    if (path.startsWith("/api/songs")) return json({ songs });
    if (path.includes("/chosen/")) {
      const id = path.split("/").pop()!;
      const { replace, mainRoad } = JSON.parse(String(init?.body ?? "{}")) as { replace?: string; mainRoad?: string };
      if (init?.method === "DELETE") {
        current.chosenLessons = current.chosenLessons.filter((lesson) => lesson !== id);
      } else if (current.chosenLessons.filter((lesson) => lesson !== mainRoad).length >= 2 && !replace) {
        return json({ error: { code: "limit", message: "Höchstens 2" } }, 409);
      } else {
        current.chosenLessons = [...current.chosenLessons.filter((lesson) => lesson !== replace), id];
      }
    }
    if (path.endsWith("/target-song")) {
      current.targetSongId = (JSON.parse(String(init?.body)) as { targetSongId: string | null }).targetSongId;
    }
    return json({ ok: true });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const writes = (fetchMock: ReturnType<typeof serve>) =>
  fetchMock.mock.calls
    .filter(([, init]) => init?.method === "PUT" || init?.method === "DELETE")
    .map(([url, init]) => ({ url, method: init?.method, body: init?.body }));

function Where() {
  return <output aria-label="Adresse">{useLocation().pathname}</output>;
}

function renderMap(path = "/hafen") {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter
        initialEntries={[`/vollbild/guitar/spiel${path}`]}
        future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
      >
        <Where />
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

const panel = () => screen.findByRole("region", { name: "Lektion" });
const tips = () => screen.findByRole("region", { name: "Tips Board" });
const nav = () => screen.findByRole("navigation", { name: "Karte navigieren" });
const mapNode = (title: string) => screen.getByRole("button", { name: new RegExp(`^${title}, `) });

// Content tests below need songs and target songs the shipped map does not have yet.
const patched: { node: MapNode; before: MapNode }[] = [];
function patchNode(id: string, extra: Partial<MapNode>) {
  const node = nodeOf(id);
  patched.push({ node, before: { ...node } });
  Object.assign(node, extra);
}

const BARDS = { title: "The Bard's Song", artist: "Blind Guardian" };

beforeEach(() => {
  queryClient.clear();
  queryClient.setDefaultOptions({ queries: { retry: false } });
});
afterEach(() => {
  vi.unstubAllGlobals();
  for (const { node, before } of patched.splice(0).reverse()) Object.assign(node, before);
  document.head.querySelector("style[data-test-map]")?.remove();
  delete (Element.prototype as Partial<Element>).scrollIntoView;
});

describe("MapScreen selection", () => {
  it("opens best next in the panel by default", async () => {
    serve({ lessons: { [FIRST]: "gelernt" } });
    renderMap();
    const step = gameContent.road[1]!;
    expect(await within(await panel()).findByRole("heading", { name: titleOf(step.lessonId) })).toBeInTheDocument();
    expect(mapNode(titleOf(step.lessonId))).toHaveAttribute("aria-pressed", "true");
  });

  it("opens a node from hafen/:nodeId", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    expect(await within(await panel()).findByRole("heading", { name: titleOf(OTHER) })).toBeInTheDocument();
  });

  it("falls back to best next for an unknown node id", async () => {
    serve({});
    renderMap("/hafen/gibt-es-nicht");
    expect(await within(await panel()).findByRole("heading", { name: titleOf(FIRST) })).toBeInTheDocument();
  });

  it("falls back to the first Harbor node without a best next", async () => {
    const lessons = Object.fromEntries(
      gameContent.nodes.filter((node) => node.available).map((node) => [node.id, "gelernt" as LessonStatus]),
    );
    serve({ lessons });
    renderMap();
    const first = gameContent.nodes.find((node) => node.path === "hafen")!;
    expect(await within(await panel()).findByRole("heading", { name: first.title })).toBeInTheDocument();
  });

  it("selects a node from the map and keeps it in the address", async () => {
    serve({});
    renderMap();
    await panel();
    await userEvent.click(mapNode(titleOf(OTHER)));
    expect(await within(await panel()).findByRole("heading", { name: titleOf(OTHER) })).toBeInTheDocument();
    expect(screen.getByRole("status", { name: "Adresse" })).toHaveTextContent(`/hafen/${OTHER}`);
  });

  it("keeps the map's zoom when another node is selected", async () => {
    serve({});
    const { container } = renderMap();
    await panel();
    await userEvent.click(screen.getByRole("button", { name: "Hineinzoomen" }));
    const svg = container.querySelector(".skill-map svg")!;
    const zoomed = svg.getAttribute("viewBox");
    await userEvent.click(within(await panel()).getByRole("button", { name: titleOf("02-anschlag") }));
    await within(await panel()).findByRole("heading", { name: titleOf("02-anschlag") });
    expect(container.querySelector(".skill-map svg")).toBe(svg);
    expect(svg.getAttribute("viewBox")).toBe(zoomed);
  });
});

describe("LessonPanel", () => {
  it("shows title, region, description and rank", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const node = nodeOf(OTHER);
    const region = gameContent.paths.find((path) => path.id === node.path)!;
    const box = await panel();
    expect(box).toHaveTextContent(region.title);
    expect(box).toHaveTextContent(node.description);
    expect(box).toHaveTextContent(`Schwierigkeit ${node.rank} von 10`);
  });

  it("links to the lesson in the library", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    expect(await within(await panel()).findByRole("link", { name: "Lektion öffnen" })).toHaveAttribute(
      "href",
      `/vollbild/guitar/spiel/bibliothek/${OTHER}`,
    );
  });

  it("shows Hauptweg instead of a take button on best next", async () => {
    serve({});
    renderMap();
    const box = await panel();
    expect(await within(box).findByText("Hauptweg")).toBeInTheDocument();
    expect(within(box).getByRole("link", { name: "Lektion öffnen" })).toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Als Quest annehmen" })).not.toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Pausieren" })).not.toBeInTheDocument();
  });

  it("offers Pausieren beside Hauptweg on a chosen best next", async () => {
    const fetchMock = serve({ chosenLessons: [FIRST] });
    renderMap();
    const box = await panel();
    expect(await within(box).findByText("Hauptweg")).toBeInTheDocument();
    await userEvent.click(within(box).getByRole("button", { name: "Pausieren" }));
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: `/api/game/guitar/chosen/${FIRST}`, method: "DELETE", body: undefined },
      ]),
    );
    await waitFor(() => expect(within(box).queryByRole("button", { name: "Pausieren" })).not.toBeInTheDocument());
    expect(within(box).getByText("Hauptweg")).toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Als Quest annehmen" })).not.toBeInTheDocument();
  });

  it("starts the best next quest from the map", async () => {
    const fetchMock = serve({ today: { minutes: 30, questIds: ["haltung-check"] } });
    renderMap();
    const start = await within(await panel()).findByRole("link", { name: "Quest starten" });
    expect(start).toHaveAttribute("href", "/vollbild/guitar/spiel/quest/haltung-check");
    await userEvent.click(start);
    await waitFor(() =>
      expect(screen.getByLabelText("Adresse")).toHaveTextContent("/vollbild/guitar/spiel/quest/haltung-check"),
    );
    expect(writes(fetchMock)).toEqual([]);
  });

  it("adds the best next quest to today's set when it is missing", async () => {
    const fetchMock = serve({ today: { minutes: 20, questIds: ["wechsel-minute"] } });
    renderMap();
    await userEvent.click(await within(await panel()).findByRole("link", { name: "Quest starten" }));
    await waitFor(() =>
      expect(screen.getByLabelText("Adresse")).toHaveTextContent("/vollbild/guitar/spiel/quest/haltung-check"),
    );
    expect(writes(fetchMock)).toEqual([
      {
        url: "/api/game/guitar/today",
        method: "PUT",
        body: JSON.stringify({ minutes: 20, questIds: ["wechsel-minute", "haltung-check"] }),
      },
    ]);
  });

  it("offers Quest starten only on the best next lesson", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    await within(box).findByRole("link", { name: "Lektion öffnen" });
    expect(within(box).queryByRole("link", { name: "Quest starten" })).not.toBeInTheDocument();
  });

  it("warns about an unfinished parent and links to it, without blocking", async () => {
    const parent = nodeOf(OTHER).parent!;
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    const note = (await within(box).findByText(/Dir fehlen noch Grundlagen:/)).closest("p")!;
    expect(note).toHaveTextContent(`Dir fehlen noch Grundlagen: ${titleOf(parent)}`);
    expect(within(box).getByRole("button", { name: "Als Quest annehmen" })).toBeEnabled();
    await userEvent.click(within(note).getByRole("button", { name: titleOf(parent) }));
    await waitFor(() =>
      expect(screen.getByLabelText("Adresse")).toHaveTextContent(`/vollbild/guitar/spiel/hafen/${parent}`),
    );
  });

  it("names no missing basics once the parent is finished", async () => {
    serve({ lessons: { [nodeOf(OTHER).parent!]: "gelernt" } });
    renderMap(`/hafen/${OTHER}`);
    await within(await panel()).findByRole("link", { name: "Lektion öffnen" });
    expect(screen.queryByText(/Dir fehlen noch Grundlagen/)).not.toBeInTheDocument();
  });

  it("names no missing basics for a parent that is not written yet", async () => {
    const id = "13-theorie";
    expect(nodeOf(nodeOf(id).parent!).available).toBe(false);
    serve({});
    renderMap(`/hafen/${id}`);
    await within(await panel()).findByRole("link", { name: "Lektion öffnen" });
    expect(screen.queryByText(/Dir fehlen noch Grundlagen/)).not.toBeInTheDocument();
  });

  it("exempts quick wins and known songs from the warning", async () => {
    const known = gameContent.nodes.find((node) => node.knownSong && node.parent !== null)!;
    expect(quick.parent).not.toBeNull();
    for (const id of [quick.id, known.id]) {
      serve({});
      const { unmount } = renderMap(`/hafen/${id}`);
      expect(await within(await panel()).findByRole("heading", { name: titleOf(id) })).toBeInTheDocument();
      expect(screen.queryByText(/Dir fehlen noch Grundlagen/)).not.toBeInTheDocument();
      unmount();
    }
  });

  it("takes a lesson as quest", async () => {
    const fetchMock = serve({});
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    expect(await within(await panel()).findByRole("button", { name: "Pausieren" })).toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([
      { url: `/api/game/guitar/chosen/${OTHER}`, method: "PUT", body: JSON.stringify({ mainRoad: FIRST }) },
    ]);
  });

  it("does not spend a side slot on the main-road lesson", async () => {
    const fetchMock = serve({ chosenLessons: [FIRST, CHOSEN[0]!] });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    expect(await within(await panel()).findByRole("button", { name: "Pausieren" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([
      { url: `/api/game/guitar/chosen/${OTHER}`, method: "PUT", body: JSON.stringify({ mainRoad: FIRST }) },
    ]);
  });

  it("leaves the main-road lesson out of the pause dialog", async () => {
    serve({ chosenLessons: [FIRST, ...CHOSEN] });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    const dialog = await screen.findByRole("dialog");
    for (const id of CHOSEN) {
      expect(within(dialog).getByRole("button", { name: titleOf(id) })).toBeInTheDocument();
    }
    expect(within(dialog).queryByRole("button", { name: titleOf(FIRST) })).not.toBeInTheDocument();
  });

  it("pauses a chosen lesson", async () => {
    const fetchMock = serve({ chosenLessons: [OTHER] });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Pausieren" }));
    expect(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" })).toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([
      { url: `/api/game/guitar/chosen/${OTHER}`, method: "DELETE", body: undefined },
    ]);
  });

  it("offers no take button on a finished lesson", async () => {
    serve({ lessons: { [OTHER]: "gelernt" } });
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    expect(await within(box).findByRole("link", { name: "Lektion öffnen" })).toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Als Quest annehmen" })).not.toBeInTheDocument();
  });

  it("asks which lesson to pause at the limit and changes nothing on cancel", async () => {
    const fetchMock = serve({ chosenLessons: CHOSEN });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    const dialog = await screen.findByRole("dialog", { name: "Welche Lektion pausierst du?" });
    for (const id of CHOSEN) {
      expect(within(dialog).getByRole("button", { name: titleOf(id) })).toBeInTheDocument();
    }
    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes(fetchMock)).toHaveLength(1);
    expect(within(await panel()).getByRole("button", { name: "Als Quest annehmen" })).toBeInTheDocument();
    expect(within(await panel()).queryByRole("alert")).not.toBeInTheDocument();
  });

  it("replaces the picked lesson at the limit", async () => {
    const fetchMock = serve({ chosenLessons: CHOSEN });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    const dialog = await screen.findByRole("dialog");
    await userEvent.click(within(dialog).getByRole("button", { name: titleOf(CHOSEN[0]!) }));
    expect(await within(await panel()).findByRole("button", { name: "Pausieren" })).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(writes(fetchMock).at(-1)).toEqual({
      url: `/api/game/guitar/chosen/${OTHER}`,
      method: "PUT",
      body: JSON.stringify({ replace: CHOSEN[0], mainRoad: FIRST }),
    });
  });

  it("shows a failed pick inside the dialog and keeps it open", async () => {
    serve({ chosenLessons: CHOSEN });
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Quest annehmen" }));
    const dialog = await screen.findByRole("dialog");
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "x", message: "Kaputt" } }, 500)));
    await userEvent.click(within(dialog).getByRole("button", { name: titleOf(CHOSEN[0]!) }));
    expect(await within(dialog).findByRole("alert")).toHaveTextContent("Kaputt");
    expect(screen.getAllByRole("alert")).toHaveLength(1);

    await userEvent.click(within(dialog).getByRole("button", { name: "Abbrechen" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("refreshes a stale list when the server reports the limit", async () => {
    serve({ chosenLessons: [CHOSEN[0]!] });
    renderMap(`/hafen/${OTHER}`);
    const take = await within(await panel()).findByRole("button", { name: "Als Quest annehmen" });
    serve({ chosenLessons: CHOSEN });
    await userEvent.click(take);
    const dialog = await screen.findByRole("dialog");
    for (const id of CHOSEN) {
      expect(await within(dialog).findByRole("button", { name: titleOf(id) })).toBeInTheDocument();
    }
  });

  it("shows a failed save", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const take = await within(await panel()).findByRole("button", { name: "Als Quest annehmen" });
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "x", message: "Kaputt" } }, 500)));
    await userEvent.click(take);
    expect(await within(await panel()).findByRole("alert")).toHaveTextContent("Kaputt");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("shows in Vorbereitung without actions for an unwritten lesson", async () => {
    patchNode(planned.id, { targetSong: BARDS });
    serve({});
    renderMap(`/hafen/${planned.id}`);
    const box = await panel();
    expect(await within(box).findByText("In Vorbereitung")).toBeInTheDocument();
    expect(box).toHaveTextContent(planned.description);
    expect(within(box).queryByRole("link")).not.toBeInTheDocument();
    expect(within(box).queryByRole("slider")).not.toBeInTheDocument();
    for (const name of ["Als Quest annehmen", "Pausieren", "Als Zielsong setzen"]) {
      expect(within(box).queryByRole("button", { name })).not.toBeInTheDocument();
    }
  });

  it("shows a known song without actions", async () => {
    const song = gameContent.nodes.find((node) => node.knownSong)!;
    serve({});
    renderMap(`/hafen/${song.id}`);
    const box = await panel();
    expect(await within(box).findByText("Bekannter Song")).toBeInTheDocument();
    expect(box).toHaveTextContent(song.description);
    expect(within(box).queryByText("In Vorbereitung")).not.toBeInTheDocument();
    expect(within(box).queryByRole("link")).not.toBeInTheDocument();
    expect(within(box).queryByRole("slider")).not.toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Als Quest annehmen" })).not.toBeInTheDocument();
  });

  it("saves the personal level from the slider", async () => {
    const techniqueId = nodeOf(OTHER).techniqueId!;
    const fetchMock = serve({ levels: { [techniqueId]: 4 } });
    renderMap(`/hafen/${OTHER}`);
    const slider = await within(await panel()).findByRole("slider", { name: "Deine Stufe" });
    expect(slider).toHaveValue("4");
    expect(slider).toHaveAttribute("min", "1");
    expect(slider).toHaveAttribute("max", "10");
    fireEvent.change(slider, { target: { value: "7" } });
    expect(slider).toHaveValue("7");
    await waitFor(() =>
      expect(writes(fetchMock)).toEqual([
        { url: `/api/game/guitar/level/${techniqueId}`, method: "PUT", body: JSON.stringify({ level: 7 }) },
      ]),
    );
  });

  it("saves a burst of slider steps once, with the last value", async () => {
    const techniqueId = nodeOf(OTHER).techniqueId!;
    const fetchMock = serve({});
    renderMap(`/hafen/${OTHER}`);
    const slider = await within(await panel()).findByRole("slider", { name: "Deine Stufe" });
    for (const value of ["4", "5", "6", "7"]) fireEvent.change(slider, { target: { value } });
    expect(writes(fetchMock)).toEqual([]);
    await waitFor(() => expect(writes(fetchMock)).toHaveLength(1));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(writes(fetchMock)).toEqual([
      { url: `/api/game/guitar/level/${techniqueId}`, method: "PUT", body: JSON.stringify({ level: 7 }) },
    ]);
  });

  it("still saves the level when the player moves on at once", async () => {
    const techniqueId = nodeOf(OTHER).techniqueId!;
    const fetchMock = serve({});
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    fireEvent.change(await within(box).findByRole("slider", { name: "Deine Stufe" }), { target: { value: "8" } });
    fireEvent.click(within(box).getAllByRole("button", { name: titleOf(nodeOf(OTHER).parent!) })[0]!);
    await within(await panel()).findByRole("heading", { name: titleOf(nodeOf(OTHER).parent!) });
    expect(writes(fetchMock)).toEqual([
      { url: `/api/game/guitar/level/${techniqueId}`, method: "PUT", body: JSON.stringify({ level: 8 }) },
    ]);
  });

  it("puts the slider back when the save fails", async () => {
    serve({ levels: { [nodeOf(OTHER).techniqueId!]: 4 } });
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    const slider = await within(box).findByRole("slider", { name: "Deine Stufe" });
    await waitFor(() => expect(slider).toHaveValue("4"));
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "x", message: "Kaputt" } }, 500)));
    fireEvent.change(slider, { target: { value: "9" } });
    expect(await within(box).findByRole("alert")).toHaveTextContent("Kaputt");
    expect(slider).toHaveValue("4");
  });

  it("selects a linked lesson from the connections list", async () => {
    const from = gameContent.nodes.find((node) => node.links.length > 0)!;
    const link = from.links[0]!;
    serve({});
    renderMap(`/hafen/${from.id}`);
    const box = await panel();
    const details = (await within(box).findByText(/^Verbindungen \(\d+\)$/)).closest("details")!;
    expect(details).toHaveAttribute("open");
    expect(details).toHaveTextContent(link.reason);
    await userEvent.click(within(details).getByRole("button", { name: titleOf(link.to) }));
    expect(await within(await panel()).findByRole("heading", { name: titleOf(link.to) })).toBeInTheDocument();
  });

  it("lists what a lesson builds on and unlocks", async () => {
    serve({});
    renderMap("/hafen/02-anschlag");
    const box = await panel();
    const child = gameContent.nodes.find((node) => node.parent === "02-anschlag")!;
    const builds = (await within(box).findByRole("heading", { name: "Baut auf" })).parentElement!;
    const unlocks = within(box).getByRole("heading", { name: "Schaltet frei" }).parentElement!;
    expect(within(builds).getByRole("button", { name: titleOf(FIRST) })).toBeInTheDocument();
    expect(within(unlocks).getByRole("button", { name: child.title })).toBeInTheDocument();
  });

  it("lists songs with artist and what they train", async () => {
    patchNode(OTHER, { songs: [{ title: "Lied", artist: "Band", trains: "Hammer-ons", source: "https://example.org" }] });
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const block = (await within(await panel()).findByRole("heading", { name: "Songs dafür" })).parentElement!;
    expect(block).toHaveTextContent("Lied");
    expect(block).toHaveTextContent("Band");
    expect(block).toHaveTextContent("Hammer-ons");
  });

  it("hides the songs block when a lesson has none", async () => {
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    await within(box).findByRole("link", { name: "Lektion öffnen" });
    expect(within(box).queryByText("Songs dafür")).not.toBeInTheDocument();
  });

  it("reminds to refine a learned quick win", async () => {
    patchNode(quick.id, { available: true });
    serve({ lessons: { [quick.id]: "gelernt" } });
    renderMap(`/hafen/${quick.id}`);
    expect(
      await within(await panel()).findByText("Schneller Erfolg geschafft. Komm zurück und verfeinere ihn."),
    ).toBeInTheDocument();
  });

  it("does not remind on an open quick win or a learned normal lesson", async () => {
    patchNode(quick.id, { available: true });
    serve({ lessons: { [OTHER]: "gelernt" } });
    const first = renderMap(`/hafen/${quick.id}`);
    await within(await panel()).findByRole("link", { name: "Lektion öffnen" });
    expect(screen.queryByText(/Schneller Erfolg geschafft/)).not.toBeInTheDocument();
    first.unmount();
    renderMap(`/hafen/${OTHER}`);
    await within(await panel()).findByRole("link", { name: "Lektion öffnen" });
    expect(screen.queryByText(/Schneller Erfolg geschafft/)).not.toBeInTheDocument();
  });
});

describe("target song", () => {
  it("offers the import when the target song is missing", async () => {
    patchNode(OTHER, { targetSong: BARDS });
    serve({}, [{ id: 1, title: "Etwas anderes" }]);
    renderMap(`/hafen/${OTHER}`);
    const link = await within(await panel()).findByRole("link", {
      name: "Importiere den Song, die Übungen funktionieren auch ohne",
    });
    expect(link).toHaveAttribute("href", "/songs/neu");
    expect(screen.queryByRole("button", { name: "Als Zielsong setzen" })).not.toBeInTheDocument();
  });

  it("reports a failed song list instead of asking to import", async () => {
    patchNode(OTHER, { targetSong: BARDS });
    serve({});
    const stateOnly = vi.mocked(fetch);
    vi.stubGlobal("fetch", vi.fn(async (url: string, init?: RequestInit) =>
      String(url).startsWith("/api/songs") ? json({}, 500) : stateOnly(url, init),
    ));
    renderMap(`/hafen/${OTHER}`);
    const box = await panel();
    expect(await within(box).findByRole("alert")).toHaveTextContent("Deine Songs konnten nicht geladen werden.");
    expect(within(box).queryByRole("link", { name: /Importiere den Song/ })).not.toBeInTheDocument();
    expect(within(box).queryByRole("button", { name: "Als Zielsong setzen" })).not.toBeInTheDocument();
  });

  it("matches a curly apostrophe and other case as the same song", async () => {
    patchNode(OTHER, { targetSong: BARDS });
    const fetchMock = serve({}, [{ id: 3, title: "  the BARD’S   song " }]);
    renderMap(`/hafen/${OTHER}`);
    await userEvent.click(await within(await panel()).findByRole("button", { name: "Als Zielsong setzen" }));
    expect(await within(await panel()).findByText("Ist dein Zielsong")).toBeInTheDocument();
    expect(writes(fetchMock)).toEqual([
      { url: "/api/game/guitar/target-song", method: "PUT", body: JSON.stringify({ targetSongId: "db:3" }) },
    ]);
  });

  it("says when the song is already the target", async () => {
    patchNode(OTHER, { targetSong: BARDS });
    serve({ targetSongId: "db:3" }, [{ id: 3, title: BARDS.title }]);
    renderMap(`/hafen/${OTHER}`);
    expect(await within(await panel()).findByText("Ist dein Zielsong")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Als Zielsong setzen" })).not.toBeInTheDocument();
  });

  it("normalizes titles", () => {
    expect(normalizeTitle("  The  Bard‘s\tSONG ")).toBe("the bard's song");
    expect(normalizeTitle("Bard`s ´x ʼy")).toBe("bard's 'x 'y");
  });

  it("strips a trailing parenthesis from titles", () => {
    expect(normalizeTitle("The Bard's Song (Chords)")).toBe("the bard's song");
    expect(normalizeTitle("  The Bard's Song  (Chords)  ")).toBe("the bard's song");
    expect(normalizeTitle("Song (live) Teil 2")).toBe("song (live) teil 2");
  });

  it("finds an imported song with a suffix as the lesson's target", async () => {
    patchNode(OTHER, { targetSong: BARDS });
    serve({}, [{ id: 3, title: `${BARDS.title} (Chords)` }]);
    renderMap(`/hafen/${OTHER}`);
    expect(await within(await panel()).findByRole("button", { name: "Als Zielsong setzen" })).toBeInTheDocument();
  });
});

describe("NavPane", () => {
  it("filters by search and difficulty", async () => {
    serve({});
    renderMap();
    const pane = await nav();
    await userEvent.type(within(pane).getByRole("searchbox", { name: "Lektion suchen" }), "POWER");
    expect(mapNode(titleOf("09-powerchords"))).not.toHaveAttribute("opacity");
    expect(mapNode(titleOf(FIRST))).toHaveAttribute("opacity", "0.22");

    await userEvent.clear(within(pane).getByRole("searchbox", { name: "Lektion suchen" }));
    expect(mapNode(titleOf(FIRST))).not.toHaveAttribute("opacity");
    await userEvent.click(within(pane).getByRole("button", { name: "7-10" }));
    expect(within(pane).getByRole("button", { name: "7-10" })).toHaveAttribute("aria-pressed", "true");
    const hard = gameContent.nodes.find((node) => node.rank >= 7)!;
    expect(mapNode(hard.title)).not.toHaveAttribute("opacity");
    expect(mapNode(titleOf(FIRST))).toHaveAttribute("opacity", "0.22");

    await userEvent.click(within(pane).getByRole("button", { name: "Alle" }));
    expect(mapNode(titleOf(FIRST))).not.toHaveAttribute("opacity");
  });

  it("offers the four difficulty chips", async () => {
    serve({});
    renderMap();
    const pane = await nav();
    for (const name of ["Alle", "1-3", "4-6", "7-10"]) {
      expect(within(pane).getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("counts progress per path", async () => {
    serve({ lessons: { [FIRST]: "gelernt", "02-anschlag": "gemeistert", "03-saiten-buende": "aktiv" } });
    renderMap();
    const pane = await nav();
    const lessonsOf = (path: string) =>
      gameContent.nodes.filter((node) => node.path === path && !node.knownSong).length;
    for (const path of gameContent.paths) {
      const done = path.id === "hafen" ? 2 : 0;
      await waitFor(() =>
        expect(within(pane).getByRole("button", { name: new RegExp(path.title) })).toHaveTextContent(
          `${done}/${lessonsOf(path.id)}`,
        ),
      );
    }
  });

  it("filters to a path and clears it on a second click", async () => {
    serve({});
    renderMap();
    const pane = await nav();
    const metal = gameContent.paths.find((path) => path.id === "metal")!;
    const row = within(pane).getByRole("button", { name: new RegExp(metal.title) });
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "true");
    expect(mapNode(titleOf(FIRST))).toHaveAttribute("opacity", "0.22");
    await userEvent.click(row);
    expect(row).toHaveAttribute("aria-pressed", "false");
    expect(mapNode(titleOf(FIRST))).not.toHaveAttribute("opacity");
  });

  it("explains the map in a legend", async () => {
    serve({});
    renderMap();
    const pane = await nav();
    for (const entry of ["Leicht, 1 bis 3", "Mittel, 4 bis 6", "Schwer, 7 bis 10", "Schneller Erfolg", "In Vorbereitung", "Als Quest angenommen"]) {
      expect(within(pane).getByText(new RegExp(entry))).toBeInTheDocument();
    }
  });
});

describe("Das erste Jahr", () => {
  const year = async () => {
    const summary = await within(await nav()).findByText("Das erste Jahr");
    const details = summary.closest("details") as HTMLDetailsElement;
    expect(details).not.toHaveAttribute("open");
    await userEvent.click(summary);
    expect(details).toHaveAttribute("open");
    return details;
  };

  it("lists every road step in road order with title and months, planned ones included", async () => {
    serve({});
    renderMap();
    const list = await year();
    const rows = within(list).getAllByRole("button");
    expect(rows).toHaveLength(gameContent.road.length);
    gameContent.road.forEach((step, i) => {
      const [from, to] = step.months;
      expect(rows[i]).toHaveTextContent(titleOf(step.lessonId));
      expect(rows[i]).toHaveTextContent(from === to ? `Monat ${from}` : `Monate ${from}–${to}`);
    });
    expect(gameContent.road.some((step) => step.questId === null)).toBe(true);
    const plannedStep = gameContent.road.find((step) => step.questId === null)!;
    expect(rows[gameContent.road.indexOf(plannedStep)]).toHaveTextContent("in Vorbereitung");
  });

  it("groups the steps by quarter", async () => {
    serve({});
    renderMap();
    const list = await year();
    const quarters = within(list).getAllByRole("heading");
    expect(quarters.map((heading) => heading.textContent)).toEqual([
      "1. Quartal, Monate 1–3",
      "2. Quartal, Monate 4–6",
      "3. Quartal, Monate 7–9",
      "4. Quartal, Monate 10–12",
    ]);
    const firstQuarter = quarters[0]!.parentElement!;
    const count = gameContent.road.filter((step) => step.months[0] <= 3).length;
    expect(within(firstQuarter).getAllByRole("button")).toHaveLength(count);
  });

  it("marks only the current step", async () => {
    const [first, second] = gameContent.road;
    serve({ lessons: { [first!.lessonId]: "gelernt" } });
    renderMap();
    const list = await year();
    await waitFor(() => {
      const current = list.querySelectorAll('[aria-current="step"]');
      expect(current).toHaveLength(1);
      expect(current[0]).toHaveTextContent(titleOf(second!.lessonId));
    });
  });

  it("selects a step on the map, a planned one too", async () => {
    serve({});
    renderMap();
    const list = await year();
    const step = gameContent.road.find((entry) => entry.questId === null)!;
    await userEvent.click(within(list).getByRole("button", { name: new RegExp(titleOf(step.lessonId)) }));
    expect(await within(await panel()).findByRole("heading", { name: titleOf(step.lessonId) })).toBeInTheDocument();
    expect(mapNode(titleOf(step.lessonId))).toHaveAttribute("aria-pressed", "true");
  });
});

describe("TipsBoard", () => {
  it("names best next with its reason and selects it", async () => {
    const step = gameContent.road[0]!;
    serve({});
    renderMap(`/hafen/${OTHER}`);
    const board = await tips();
    expect(await within(board).findByText("Bester nächster Schritt")).toBeInTheDocument();
    expect(board).toHaveTextContent(step.reason);
    await userEvent.click(within(board).getByRole("button", { name: titleOf(step.lessonId) }));
    expect(await within(await panel()).findByRole("heading", { name: titleOf(step.lessonId) })).toBeInTheDocument();
  });

  it("offers a quick win, and refining once it is learned", async () => {
    patchNode(quick.id, { available: true });
    serve({});
    const first = renderMap();
    const board = await tips();
    expect(await within(board).findByText("Schneller Erfolg")).toBeInTheDocument();
    await userEvent.click(within(board).getByRole("button", { name: quick.title }));
    expect(await within(await panel()).findByRole("heading", { name: quick.title })).toBeInTheDocument();
    first.unmount();

    queryClient.clear();
    const quickWins = gameContent.nodes.filter((node) => node.quick && node.available);
    serve({ lessons: Object.fromEntries(quickWins.map((node) => [node.id, "gelernt" as LessonStatus])) });
    renderMap();
    expect(await within(await tips()).findByText("Verfeinern")).toBeInTheDocument();
  });

  it("gives the stay-on-track tip for the chosen lessons", async () => {
    serve({ chosenLessons: CHOSEN });
    renderMap();
    const board = await tips();
    expect(await within(board).findByText("Bleib auf Kurs")).toBeInTheDocument();
    expect(board).toHaveTextContent("Zwei Nebenwege reichen. Bring erst einen davon zu Ende.");
  });

  it("shows the coming-soon note when written lessons are finished", async () => {
    const lessons = Object.fromEntries(
      gameContent.road
        .filter((step) => step.questId !== null)
        .map((step) => [step.lessonId, "gelernt" as LessonStatus]),
    );
    serve({ lessons });
    renderMap();
    const board = await tips();
    expect(
      await within(board).findByText("Alle fertigen Lektionen auf dem Hauptweg sind geschafft. Weitere folgen."),
    ).toBeInTheDocument();
    expect(within(board).queryByText("Bester nächster Schritt")).not.toBeInTheDocument();
  });
});

describe("narrow screen", () => {
  // jsdom skips @media rules, so the stylesheet applies as on the narrowest screen.
  function useMapStyles() {
    const style = document.createElement("style");
    style.dataset.testMap = "";
    style.textContent = readFileSync(join(__dirname, "map.css"), "utf8");
    document.head.append(style);
  }

  const list = () => screen.findByRole("list", { name: "Lektionen dieses Pfads" });

  it("shows a list instead of the map on a narrow screen", async () => {
    useMapStyles();
    serve({});
    const { container } = renderMap();
    const items = await list();
    expect(items).toBeVisible();
    expect(container.querySelector(".skill-map")).not.toBeVisible();
  });

  it("brings the panel into view after a tap, as the map is not there to show it", async () => {
    const scroll = vi.fn();
    Element.prototype.scrollIntoView = scroll;
    serve({});
    renderMap();
    await userEvent.click(within(await list()).getByRole("button", { name: new RegExp(titleOf("02-anschlag")) }));
    expect(scroll).toHaveBeenCalledOnce();
    expect(scroll.mock.contexts[0]).toContainElement(await panel());
  });

  it("lists the selected node's path until a path is chosen", async () => {
    serve({});
    renderMap();
    const items = await list();
    const hafen = gameContent.nodes.filter((node) => node.path === "hafen");
    expect(within(items).getAllByRole("button")).toHaveLength(hafen.length);

    const metal = gameContent.paths.find((path) => path.id === "metal")!;
    await userEvent.click(within(await nav()).getByRole("button", { name: new RegExp(metal.title) }));
    const count = gameContent.nodes.filter((node) => node.path === "metal").length;
    expect(within(await list()).getAllByRole("button")).toHaveLength(count);
  });

  it("labels rows like the map: aktiv only when chosen or best next", async () => {
    serve({ lessons: { [FIRST]: "aktiv", "02-anschlag": "aktiv", "03-saiten-buende": "aktiv" }, chosenLessons: ["02-anschlag"] });
    renderMap();
    const items = await list();
    const row = (id: string) => within(items).getByRole("button", { name: new RegExp(titleOf(id)) });
    await waitFor(() => expect(row("03-saiten-buende")).toHaveTextContent("begonnen"));
    expect(row(FIRST)).toHaveTextContent("· aktiv");
    expect(row("02-anschlag")).toHaveTextContent("· aktiv");
  });

  it("searches all paths from the list", async () => {
    serve({});
    renderMap();
    await list();
    await userEvent.type(within(await nav()).getByRole("searchbox"), "Thrash");
    const hits = gameContent.nodes.filter((node) => node.title.toLowerCase().includes("thrash"));
    expect(hits.length).toBeGreaterThan(0);
    expect(within(await list()).getAllByRole("button")).toHaveLength(hits.length);
  });

  it("says when nothing matches", async () => {
    serve({});
    renderMap();
    await list();
    await userEvent.type(within(await nav()).getByRole("searchbox"), "xyzzy");
    expect(await screen.findByText("Keine Lektion gefunden.")).toBeInTheDocument();
  });

  it("selects a node from the list", async () => {
    serve({});
    renderMap();
    const row = within(await list()).getByRole("button", { name: new RegExp(titleOf("02-anschlag")) });
    await userEvent.click(row);
    expect(await within(await panel()).findByRole("heading", { name: titleOf("02-anschlag") })).toBeInTheDocument();
    expect(row).toHaveAttribute("aria-pressed", "true");
  });
});

describe("the map's ring", () => {
  it("follows the chosen lessons, not the status", async () => {
    serve({ lessons: { "02-anschlag": "aktiv" }, chosenLessons: [OTHER] });
    renderMap();
    await panel();
    await waitFor(() => expect(mapNode(titleOf(OTHER)).querySelector(".map-active-ring")).not.toBeNull());
    expect(mapNode(titleOf("02-anschlag")).querySelector(".map-active-ring")).toBeNull();
  });
});

describe("gameApi map writes", () => {
  it("rethrows the limit as an ApiError", async () => {
    serve({ chosenLessons: CHOSEN });
    await expect(gameApi.chooseLesson(OTHER)).rejects.toMatchObject({ name: "ApiError", code: "limit" });
  });

  it("writes to the chosen and target song routes", async () => {
    const fetchMock = serve({});
    await gameApi.chooseLesson("a");
    await gameApi.chooseLesson("b", "a");
    await gameApi.chooseLesson("c", undefined, "road");
    await gameApi.pauseLesson("b");
    await gameApi.setTargetSong("db:1");
    await gameApi.setTargetSong(null);
    expect(writes(fetchMock)).toEqual([
      { url: "/api/game/guitar/chosen/a", method: "PUT", body: "{}" },
      { url: "/api/game/guitar/chosen/b", method: "PUT", body: JSON.stringify({ replace: "a" }) },
      { url: "/api/game/guitar/chosen/c", method: "PUT", body: JSON.stringify({ mainRoad: "road" }) },
      { url: "/api/game/guitar/chosen/b", method: "DELETE", body: undefined },
      { url: "/api/game/guitar/target-song", method: "PUT", body: JSON.stringify({ targetSongId: "db:1" }) },
      { url: "/api/game/guitar/target-song", method: "PUT", body: JSON.stringify({ targetSongId: null }) },
    ]);
  });
});
