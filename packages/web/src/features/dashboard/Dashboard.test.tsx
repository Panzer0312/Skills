import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Dashboard } from "./Dashboard.js";

vi.mock("../../skills/registry.js", () => ({
  getSkills: () => [
    {
      dir: "demo",
      manifest: { id: "demo", name: "Demo", icon: "sparkles", accent: "#4f46e5", description: "", modules: [] },
      data: {},
    },
  ],
  getBrokenSkills: () => [{ dir: "kaputt", error: "id: muss ein Slug sein" }],
}));

vi.mock("../../skills/useSeedSync.js", () => ({
  useSeedSync: () => ({ status: "done", error: null }),
}));

function renderDashboard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("Dashboard", () => {
  it("shows the streak and the due count per skill", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/api/stats")) {
          return new Response(
            JSON.stringify({ heatmap: [], retention: 0.9, states: {}, forecast: [], streak: 5 }),
            { status: 200 },
          );
        }
        return new Response(JSON.stringify({ cards: [{ id: 1 }, { id: 2 }] }), { status: 200 });
      }),
    );
    renderDashboard();
    expect(await screen.findByText(/5 Tage/)).toBeInTheDocument();
    expect(await screen.findByText("Demo")).toBeInTheDocument();
    expect(await screen.findByText(/2 fällig/)).toBeInTheDocument();
  });

  it("warns about skills that failed to load", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ heatmap: [], retention: 0, states: {}, forecast: [], streak: 0, cards: [] }), {
          status: 200,
        }),
      ),
    );
    renderDashboard();
    expect(await screen.findByText(/kaputt/)).toBeInTheDocument();
  });
});
