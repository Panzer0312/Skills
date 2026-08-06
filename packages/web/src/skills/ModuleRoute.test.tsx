import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { ModuleRoute } from "./ModuleRoute.js";

const manifest = {
  id: "demo",
  name: "Demo",
  icon: "sparkles",
  accent: "#4f46e5",
  description: "",
  modules: [
    { id: "cards", type: "srs-deck", title: "Karten", pinned: false, data: ["decks/a.json"] },
    { id: "info", type: "reference", title: "Nachschlagen", pinned: false, data: ["ref/a.json"] },
  ],
};

vi.mock("./registry.js", () => ({
  getSkill: (id: string) =>
    id === "demo"
      ? {
          dir: "demo",
          manifest,
          data: {
            "decks/a.json": { deck: "A", cards: [{ key: "x", front: "X", back: "Xe" }] },
            "ref/a.json": [{ zeichen: "あ", laut: "a" }],
          },
        }
      : undefined,
}));

vi.mock("./widgets.js", () => ({ loadWidget: () => null }));

function renderRoute(path: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/skill/:skillId/:moduleId" element={<ModuleRoute />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("ModuleRoute", () => {
  it("renders the deck renderer for an srs-deck module", () => {
    renderRoute("/skill/demo/cards");
    expect(screen.getByRole("heading", { name: "Karten" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /wiederholen/i })).toHaveAttribute(
      "href",
      "/review?skillId=demo&moduleId=cards",
    );
  });

  it("renders the reference renderer as a table", () => {
    renderRoute("/skill/demo/info");
    expect(screen.getByRole("table")).toBeInTheDocument();
    expect(screen.getByText("あ")).toBeInTheDocument();
  });

  it("reports an unknown skill without crashing", () => {
    renderRoute("/skill/gibtsnicht/cards");
    expect(screen.getByText(/existiert nicht/i)).toBeInTheDocument();
  });

  it("reports an unknown module without crashing", () => {
    renderRoute("/skill/demo/gibtsnicht");
    expect(screen.getByText(/existiert nicht/i)).toBeInTheDocument();
  });
});
