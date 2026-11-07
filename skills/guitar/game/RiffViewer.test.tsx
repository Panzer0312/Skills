import type { GameState } from "@skills/core";
import { localDayKey, PREFS } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import GameApp from "../widgets/GameApp.js";
import { gameContent } from "./api.js";
import { RiffCard } from "./RiffViewer.js";

const base: GameState = {
  day: localDayKey(Date.now()),
  placed: true,
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
  storySeen: [],
  today: null,
};

const json = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string) =>
      String(url).includes("/state")
        ? json(base)
        : String(url).includes("/prefs")
          ? json({ prefs: { ...Object.fromEntries(Object.entries(PREFS).map(([k, d]) => [k, d.default])), "intro.gesehen": true } })
          : json({ ok: true }),
    ),
  );
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      destination = {};
      createOscillator = () => ({ frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() });
      createGain = () => ({
        gain: { setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() },
        connect: vi.fn(),
      });
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});
    },
  );
});
afterEach(() => vi.unstubAllGlobals());

const riff = {
  id: "test",
  title: "Testriff",
  description: "Zum Testen",
  lessonId: "metal-erster-riff",
  bpm: 84,
  zeilen: ["-0-", "-0-", "-0-", "-0-", "-0-", "-0-"],
};

function renderCard(extra: Partial<typeof riff> & { tuning?: string }, onTempo = vi.fn()) {
  render(
    <MemoryRouter>
      <RiffCard riff={{ ...riff, ...extra }} onTempo={onTempo} />
    </MemoryRouter>,
  );
  return onTempo;
}

function renderGame(path: string) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[`/vollbild/guitar/spiel${path}`]}>
        <Routes>
          <Route
            path="/vollbild/:skillId/:moduleId/*"
            element={<GameApp data={[]} progress={{} as never} settings={{}} />}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("RiffViewer", () => {
  it("sets the metronome to the riff's tempo", async () => {
    const onTempo = renderCard({});
    await userEvent.setup().click(screen.getByRole("button", { name: "Metronom auf 84 BPM stellen" }));
    expect(onTempo).toHaveBeenCalledWith(84);
  });

  it("links to the lesson", () => {
    renderCard({});
    expect(screen.getByRole("link", { name: "Lektion lesen" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/bibliothek/metal-erster-riff",
    );
  });

  it("links a riff in another tuning to the Shrine", () => {
    renderCard({ tuning: "Drop D" });
    expect(screen.getByRole("link", { name: "Stimmung: Drop D" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/schrein?stimmung=Drop%20D",
    );
  });

  it("links the Shrine back to the quest the card sits in", () => {
    render(
      <MemoryRouter>
        <RiffCard riff={{ ...riff, tuning: "Drop D" }} onTempo={vi.fn()} inQuest questId="erstes-riff" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Stimmung: Drop D" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/schrein?stimmung=Drop%20D&quest=erstes-riff",
    );
  });

  it("shows one Shrine link when quest and riff both have a tuning", () => {
    render(
      <MemoryRouter>
        <RiffCard riff={{ ...riff, tuning: "Drop D" }} onTempo={vi.fn()} inQuest questId="q" tuningLinked />
      </MemoryRouter>,
    );
    expect(screen.queryByRole("link", { name: /Stimmung/ })).not.toBeInTheDocument();
  });

  it("shows the riff inside its quest", async () => {
    expect(gameContent.quests.find((quest) => quest.id === "erstes-riff")?.riffId).toBeTruthy();
    renderGame("/quest/erstes-riff");
    expect(await screen.findByLabelText(/^Tabulatur/)).toBeInTheDocument();
  });

  it("lists the riffs on its page", async () => {
    renderGame("/riffs");
    expect(await screen.findAllByLabelText(/^Tabulatur/)).toHaveLength(gameContent.riffs.length);
  });
});
