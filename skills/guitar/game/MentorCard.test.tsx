import type { GameState } from "@skills/core";
import { localDayKey } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { story } from "./api.js";
import { MentorCard } from "./MentorCard.js";
import { StoryLog } from "./StoryLog.js";

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
  chosenLessons: [],
  records: {},
  recentQuestIds: [],
  storySeen: [],
  today: null,
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
const wrap = (ui: React.ReactNode) =>
  render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

afterEach(() => vi.unstubAllGlobals());

describe("MentorCard", () => {
  it("shows the pending beat and saves all reached beats on Weiter", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    wrap(<MentorCard state={base} />);
    expect(screen.getByText(story.beats[0]!.title)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("/api/game/guitar/story/seen");
    expect(JSON.parse(String(init.body))).toEqual({ beatIds: [story.beats[0]!.id] });
  });

  it("renders nothing when every beat is seen", () => {
    wrap(<MentorCard state={{ ...base, storySeen: story.beats.map((b) => b.id) }} />);
    expect(screen.queryByRole("button", { name: "Weiter" })).toBeNull();
  });

  it("keeps the card and alerts when saving fails", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: { code: "x", message: "kaputt" } }, 500)));
    wrap(<MentorCard state={base} />);
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Weiter" })).toBeInTheDocument();
  });
});

describe("StoryLog", () => {
  it("shows the chapter, its theory lessons and the story so far", () => {
    wrap(<StoryLog state={{ ...base, lessons: { "03-saiten-buende": "gelernt" } }} titles={{ "03-saiten-buende": "Saiten und Bünde" }} />);
    expect(screen.getByText("Passt zu diesem Kapitel")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Saiten und Bünde" })).toHaveAttribute(
      "href",
      "/vollbild/guitar/spiel/bibliothek/03-saiten-buende",
    );
    expect(screen.getByText("Bisherige Geschichte")).toBeInTheDocument();
    expect(screen.getByText(/erledigt/)).toBeInTheDocument();
  });
});
