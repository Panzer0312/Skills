import { QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { PlacementGate } from "../GameShell.js";
import {
  finishTestLoading,
  prefWrites,
  resetTestPrefs,
  testPref,
} from "../testPrefs.js";
import { IntroTour } from "./IntroTour.js";
import { openIntroStep } from "./helpBus.js";
import intro from "./intro.json";

vi.mock("../usePref.js", async () => ({
  usePref: (await import("../testPrefs.js")).usePref,
}));
const placed = { value: false };
vi.mock("../api.js", async (orig) => ({
  ...(await orig<typeof import("../api.js")>()),
  useGameState: () => ({ isPending: false, data: { placed: placed.value } }),
}));

function renderTour() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/vollbild/guitar/spiel"]}>
        <IntroTour />
        <Routes>
          <Route element={<PlacementGate />}>
            <Route path="/vollbild/guitar/spiel" element={<p>Dorf</p>} />
          </Route>
          <Route
            path="/vollbild/guitar/spiel/einstufung"
            element={<h1>Einstufung</h1>}
          />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  placed.value = true;
  resetTestPrefs();
});

describe("IntroTour", () => {
  it("tour shows on first launch and not after skip", async () => {
    renderTour();
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(intro.steps[0]!.title);
    expect(screen.getByRole("button", { name: "Weiter" })).toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(testPref("intro.gesehen")).toBe(true);
  });

  it("does not show while prefs load or once seen", () => {
    resetTestPrefs({}, { loading: true });
    const first = renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    first.unmount();
    resetTestPrefs({ "intro.gesehen": true });
    renderTour();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    act(() => finishTestLoading());
  });

  it("escape skips", async () => {
    renderTour();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(testPref("intro.gesehen")).toBe(true);
  });

  it("finish sets intro.gesehen", async () => {
    renderTour();
    expect(screen.getByRole("button", { name: "Zurück" })).toBeDisabled();
    for (let i = 0; i < intro.steps.length - 1; i++) {
      expect(prefWrites).toHaveLength(0);
      await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    }
    expect(screen.getByRole("dialog")).toHaveTextContent(
      intro.steps.at(-1)!.title,
    );
    await userEvent.click(screen.getByRole("button", { name: "Zurück" }));
    await userEvent.click(screen.getByRole("button", { name: "Weiter" }));
    await userEvent.click(screen.getByRole("button", { name: "Fertig" }));
    expect(prefWrites).toEqual([{ key: "intro.gesehen", value: true }]);
  });

  it("help button shows one step", async () => {
    resetTestPrefs({ "intro.gesehen": true });
    renderTour();
    act(() => openIntroStep("chronik"));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent(
      intro.steps.find((s) => s.id === "chronik")!.title,
    );
    expect(
      screen.queryByRole("button", { name: "Zurück" }),
    ).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(prefWrites).toHaveLength(0);
  });

  it("placement redirect happens after the tour", async () => {
    placed.value = false;
    renderTour();
    expect(screen.getByText("Dorf")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(
      await screen.findByRole("heading", { name: "Einstufung" }),
    ).toBeInTheDocument();
  });
});
