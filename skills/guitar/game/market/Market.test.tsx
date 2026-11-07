import { GEAR, localDayKey, type GameState } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { playEffect } from "../sound/effects.js";
import { Market } from "./Market.js";

vi.mock("../sound/effects.js", () => ({ playEffect: vi.fn() }));

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
  gold: 0,
  owned: [],
  equipped: {},
  sound: false,
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function serve(state: Partial<GameState>, buy?: () => Response) {
  let bought: string[] = [];
  const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).includes("/market/buy")) {
      if (buy) return buy();
      await new Promise((resolve) => setTimeout(resolve, 50));
      bought = [...bought, JSON.parse(String(init?.body)).itemId];
      return json({ gold: 0 });
    }
    if (init?.method === "PUT") return json({ ok: true });
    return json({ ...base, ...state, owned: [...(state.owned ?? []), ...bought] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function renderMarket() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <Market />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

const trader = () => GEAR.filter((item) => item.price !== null);
const milestones = () => GEAR.filter((item) => item.milestone !== null);

beforeEach(() => {
  queryClient.clear();
  vi.mocked(playEffect).mockClear();
});

afterEach(() => vi.unstubAllGlobals());

describe("Market", () => {
  it("gives a brand-new player a valid market with every buy button disabled", async () => {
    serve({});
    renderMarket();
    expect(await screen.findByRole("heading", { name: "Händler" })).toBeInTheDocument();
    const buttons = screen.getAllByRole("button", { name: /kaufen$/ });
    expect(buttons).toHaveLength(trader().length);
    for (const button of buttons) expect(button).toBeDisabled();
    expect(screen.getAllByText("Nicht genug Gold")).toHaveLength(trader().length);
    expect(screen.getAllByText("leer")).toHaveLength(5);
    expect(screen.getAllByText(/Verdient durch:/)).toHaveLength(milestones().length);
  });

  it("offers every reward at road end", async () => {
    serve({ owned: milestones().map((item) => item.id), gold: 5 });
    renderMarket();
    await screen.findByRole("heading", { name: "Belohnungen" });
    for (const item of milestones()) {
      expect(screen.getByRole("button", { name: `${item.name} anlegen` })).toBeEnabled();
    }
    expect(screen.queryByText(/Verdient durch:/)).not.toBeInTheDocument();
  });

  it("sends one purchase on a double click and plays the coin", async () => {
    const fetchMock = serve({ gold: 500 });
    renderMarket();
    const button = await screen.findByRole("button", { name: "Wanderdolch kaufen" });
    await userEvent.dblClick(button);
    await waitFor(() => expect(playEffect).toHaveBeenCalledWith("coin"));
    const posts = fetchMock.mock.calls.filter(([url]) => String(url).includes("/market/buy"));
    expect(posts).toHaveLength(1);
    expect(JSON.parse(String(posts[0]?.[1]?.body))).toEqual({ itemId: "wanderdolch" });
  });

  it("shows the server's refusal in an alert and keeps the screen", async () => {
    serve({ gold: 500 }, () => json({ error: "Schon in deinem Besitz", reason: "schon-besessen" }, 409));
    renderMarket();
    await userEvent.click(await screen.findByRole("button", { name: "Wanderdolch kaufen" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Schon in deinem Besitz");
    expect(screen.getByRole("heading", { name: "Händler" })).toBeInTheDocument();
    expect(playEffect).not.toHaveBeenCalled();
  });

  it("equips an owned item and unequips it from the slot tile", async () => {
    const fetchMock = serve({ owned: ["wanderdolch"], equipped: { waffe: "wanderdolch" } });
    renderMarket();
    expect(await screen.findByText("Angelegt")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Wanderdolch ablegen" }));
    await waitFor(() => expect(playEffect).toHaveBeenCalledWith("equip"));
    const put = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/equip"));
    expect(JSON.parse(String(put?.[1]?.body))).toEqual({ slot: "waffe", itemId: null });
  });

  it("ignores an equipped id that is not in the catalogue", async () => {
    serve({ equipped: { waffe: "gibt-es-nicht" } });
    renderMarket();
    const slots = (await screen.findByRole("heading", { name: "Deine Ausrüstung" })).nextElementSibling as HTMLElement;
    expect(within(slots).getAllByText("leer")).toHaveLength(5);
  });
});
