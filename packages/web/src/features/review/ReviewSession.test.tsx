import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ReviewSession } from "./ReviewSession.js";

const card = {
  id: 1,
  skillId: "demo",
  moduleId: "cards",
  cardKey: "a",
  front: { text: "Vorderseite" },
  back: { text: "Rückseite", reading: null, note: null, example: null },
  tags: [],
  scheduling: { state: "new", due: Date.now(), stability: 0, difficulty: 0, reps: 0, lapses: 0, lastReview: null },
  preview: { "1": { due: Date.now() + 60_000 }, "2": { due: Date.now() + 600_000 }, "3": { due: Date.now() + 86_400_000 }, "4": { due: Date.now() + 4 * 86_400_000 } },
};

function renderSession() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={["/review?skillId=demo"]}>
        <ReviewSession />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("ReviewSession", () => {
  it("hides the answer until it is revealed", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ cards: [card] }), { status: 200 })));
    renderSession();
    expect(await screen.findByText("Vorderseite")).toBeInTheDocument();
    expect(screen.queryByText("Rückseite")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /aufdecken/i }));
    expect(screen.getByText("Rückseite")).toBeInTheDocument();
  });

  it("shows the next due date on every rating button", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({ cards: [card] }), { status: 200 })));
    renderSession();
    await userEvent.click(await screen.findByRole("button", { name: /aufdecken/i }));
    expect(screen.getByRole("button", { name: /Nochmal/ })).toHaveTextContent("in 1 Min.");
    expect(screen.getByRole("button", { name: /Leicht/ })).toHaveTextContent("in 4 Tagen");
  });

  it("posts the rating and moves to the empty state", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/api/reviews") && init?.method === "POST") {
        return new Response(JSON.stringify({ scheduling: card.scheduling }), { status: 200 });
      }
      return new Response(JSON.stringify({ cards: [card] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSession();
    await userEvent.click(await screen.findByRole("button", { name: /aufdecken/i }));
    await userEvent.click(screen.getByRole("button", { name: /Gut/ }));

    await waitFor(() => {
      const posted = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(posted).toBeDefined();
      expect(JSON.parse(String(posted![1]!.body))).toMatchObject({ cardId: 1, rating: 3 });
    });
    expect(await screen.findByText(/Nichts mehr fällig/i)).toBeInTheDocument();
  });

  it("shows a retry prompt when the server is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => { throw new TypeError("Failed to fetch"); }));
    renderSession();
    expect(await screen.findByText(/nicht erreichbar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /erneut/i })).toBeInTheDocument();
  });

  it("reveals with the space key and rates with number keys", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).includes("/api/reviews") && init?.method === "POST") {
        return new Response(JSON.stringify({ scheduling: card.scheduling }), { status: 200 });
      }
      return new Response(JSON.stringify({ cards: [card] }), { status: 200 });
    });
    vi.stubGlobal("fetch", fetchMock);

    renderSession();
    await screen.findByText("Vorderseite");
    await userEvent.keyboard(" ");
    expect(screen.getByText("Rückseite")).toBeInTheDocument();
    await userEvent.keyboard("3");
    await waitFor(() => {
      expect(fetchMock.mock.calls.some(([, init]) => init?.method === "POST")).toBe(true);
    });
  });
});
