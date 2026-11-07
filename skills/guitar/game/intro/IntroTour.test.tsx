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
import { resetIntroDismissed } from "./dismissed.js";
import { openIntroStep } from "./helpBus.js";
import intro from "./intro.json";

const failWrites = vi.hoisted(() => ({ value: false }));
vi.mock("../usePref.js", async () => {
  const { usePref } = await import("../testPrefs.js");
  return {
    usePref: (key: Parameters<typeof usePref>[0]) => {
      const [value, set, meta] = usePref(key);
      // A refused write rolls back: the value never changes.
      return [value, failWrites.value ? () => {} : set, meta] as ReturnType<typeof usePref>;
    },
  };
});
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
  failWrites.value = false;
  resetIntroDismissed();
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

  it("a failing pref write still closes the tour for the session and lets placement happen", async () => {
    failWrites.value = true;
    placed.value = false;
    renderTour();
    await userEvent.click(screen.getByRole("button", { name: "Überspringen" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Einstufung" })).toBeInTheDocument();
  });

  it("escape works after focus moved to the body, and tab wraps inside", async () => {
    renderTour();
    (document.activeElement as HTMLElement).blur();
    expect(document.body).toHaveFocus();
    await userEvent.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    const buttons = screen.getAllByRole("button").filter((b) => !(b as HTMLButtonElement).disabled);
    buttons.at(-1)!.focus();
    await userEvent.tab();
    expect(screen.getByRole("dialog")).toContainElement(document.activeElement as HTMLElement);
    expect(document.activeElement).toBe(buttons[0]);
    document.body.focus();
    (document.activeElement as HTMLElement).blur();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("keys do not reach page handlers while open", async () => {
    const seen = vi.fn();
    window.addEventListener("keydown", seen);
    renderTour();
    await userEvent.keyboard("x");
    window.removeEventListener("keydown", seen);
    expect(seen).not.toHaveBeenCalled();
  });

  it("restores focus on close, also in help mode", async () => {
    resetTestPrefs({ "intro.gesehen": true });
    render(<button type="button">Ausloeser</button>);
    renderTour();
    const trigger = screen.getByRole("button", { name: "Ausloeser" });
    trigger.focus();
    act(() => openIntroStep("chronik"));
    expect(trigger).not.toHaveFocus();
    await userEvent.click(screen.getByRole("button", { name: "Schließen" }));
    expect(trigger).toHaveFocus();
  });
});
