import type { GameState } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { StatusBar } from "./StatusBar.js";

vi.mock("./sound/SoundToggle.js", () => ({ SoundToggle: () => <button type="button">Ton</button> }));

const state = {
  level: 2,
  title: "Novice",
  xpIntoLevel: 10,
  xpForNext: 100,
  streak: 1,
  totalSeconds: 600,
  weekSeconds: 60,
  gold: 42,
  owned: [],
  equipped: {},
} as unknown as GameState;

function bar(overrides: Partial<GameState> = {}) {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <StatusBar state={{ ...state, ...overrides }} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe("StatusBar", () => {
  it("links back to the app", () => {
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter>
          <StatusBar state={undefined} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(screen.getByRole("link", { name: "Zur App" })).toHaveAttribute("href", "/");
  });

  it("shows gold and the sound toggle", () => {
    bar();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText(/Gold/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ton" })).toBeInTheDocument();
  });

  it("shows equipped gear by name", () => {
    bar({ equipped: { waffe: "wanderdolch", kopf: "eisenhelm" } });
    expect(screen.getByAltText("Wanderdolch")).toBeInTheDocument();
    expect(screen.getByAltText("Eisenhelm")).toBeInTheDocument();
  });

  it("renders nothing for an unknown equipped id", () => {
    bar({ equipped: { waffe: "gibt-es-nicht" } });
    expect(document.querySelector(".gear-strip")).toBeNull();
  });
});
