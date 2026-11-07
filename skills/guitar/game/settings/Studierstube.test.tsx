import { PREFS, type PrefGroup } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { gameApi, PREFS_KEY } from "../api.js";
import { prefWrites, resetTestPrefs, testPref } from "../testPrefs.js";
import { dismissIntro } from "../intro/dismissed.js";
import { Studierstube } from "./Studierstube.js";

vi.mock("../usePref.js", async () => ({ usePref: (await import("../testPrefs.js")).usePref }));
vi.mock("../devices/DeviceCheck.js", () => ({ DeviceCheck: () => <p>Geraetepruefung</p> }));

const LABELS: Record<PrefGroup, string> = {
  allgemein: "Allgemein",
  klang: "Klang",
  ueben: "Üben",
  werkzeuge: "Werkzeuge",
  geraete: "Geräte",
  darstellung: "Darstellung",
  mentor: "Mentor",
  daten: "Daten",
};

function screenUnderTest() {
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={["/studierstube"]}>
        <Routes>
          <Route path="/studierstube" element={<Studierstube />} />
          <Route path="*" element={<p>Dorf</p>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  resetTestPrefs();
  vi.restoreAllMocks();
});

describe("Studierstube", () => {
  it("offers the help button for its intro step", () => {
    screenUnderTest();
    expect(screen.getByRole("button", { name: "Hilfe von Meister Orlo" })).toBeInTheDocument();
  });

  it("tabs appear only for groups with visible prefs", () => {
    screenUnderTest();
    const visible = new Set(
      Object.values(PREFS)
        .filter((d) => d.ui.kind !== "hidden")
        .map((d) => d.group),
    );
    for (const [group, label] of Object.entries(LABELS) as [PrefGroup, string][]) {
      const shown = screen.queryByRole("tab", { name: label }) !== null;
      expect(shown, label).toBe(group === "daten" || visible.has(group));
    }
    expect(screen.getByRole("tab", { name: "Üben" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Geräte" })).toBeInTheDocument();
  });

  it("number pref clamps on blur and saves", () => {
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Üben" }));
    const input = screen.getByLabelText(/ab wie vielen Minuten/);
    fireEvent.change(input, { target: { value: "999" } });
    fireEvent.blur(input);
    expect(prefWrites.at(-1)).toEqual({ key: "freiUeben.nachfragenAbMinuten", value: 240 });
    expect(input).toHaveValue(240);
  });

  it("does not save on change alone, clamps below min, reverts garbage, commits on Enter", () => {
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Üben" }));
    const input = screen.getByLabelText(/ab wie vielen Minuten/);
    fireEvent.change(input, { target: { value: "120" } });
    expect(prefWrites).toEqual([]);
    fireEvent.change(input, { target: { value: "1" } });
    fireEvent.blur(input);
    expect(prefWrites.at(-1)).toEqual({ key: "freiUeben.nachfragenAbMinuten", value: 15 });
    const count = prefWrites.length;
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    expect(input).toHaveValue(15);
    expect(prefWrites).toHaveLength(count);
    fireEvent.change(input, { target: { value: "100" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(prefWrites.at(-1)).toEqual({ key: "freiUeben.nachfragenAbMinuten", value: 100 });
  });

  it("reset one field calls resetPref and refreshes", async () => {
    const reset = vi.spyOn(gameApi, "resetPref").mockResolvedValue({ ok: true });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Üben" }));
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    await waitFor(() => expect(reset).toHaveBeenCalledWith("freiUeben.nachfragenAbMinuten"));
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PREFS_KEY }));
  });

  it("moves between tabs with arrow keys, Home and End", () => {
    screenUnderTest();
    const tabs = screen.getAllByRole("tab");
    expect(tabs[0]).toHaveAttribute("tabindex", "0");
    expect(tabs[1]).toHaveAttribute("tabindex", "-1");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowRight" });
    expect(tabs[1]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[1]!, { key: "End" });
    expect(tabs.at(-1)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs.at(-1)!, { key: "ArrowRight" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs[0]!, { key: "ArrowLeft" });
    expect(tabs.at(-1)).toHaveAttribute("aria-selected", "true");
    fireEvent.keyDown(tabs.at(-1)!, { key: "Home" });
    expect(tabs[0]).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("tabindex", "0");
  });

  it("embeds the device check in the Geräte tab", () => {
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Geräte" }));
    expect(screen.getByText("Geraetepruefung")).toBeInTheDocument();
  });

  it("reset all asks first", async () => {
    const reset = vi.spyOn(gameApi, "resetPrefs").mockResolvedValue({ ok: true });
    const invalidate = vi.spyOn(queryClient, "invalidateQueries");
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    fireEvent.click(screen.getByRole("button", { name: "Alle Einstellungen zurücksetzen" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Alle Einstellungen zurücksetzen" }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(invalidate).toHaveBeenCalledWith({ queryKey: PREFS_KEY }));
  });

  it("shows an error when reset all fails", async () => {
    vi.spyOn(gameApi, "resetPrefs").mockRejectedValue(new Error("x"));
    vi.spyOn(window, "confirm").mockReturnValue(true);
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    fireEvent.click(screen.getByRole("button", { name: "Alle Einstellungen zurücksetzen" }));
    expect(await screen.findByText("Zurücksetzen fehlgeschlagen.")).toBeInTheDocument();
  });

  it("offers the data export", () => {
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    expect(screen.getByRole("link", { name: "Daten exportieren" })).toHaveAttribute("href", gameApi.exportUrl);
  });

  it("replay intro clears intro.gesehen", () => {
    resetTestPrefs({ "intro.gesehen": true });
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    fireEvent.click(screen.getByRole("button", { name: "Intro erneut ansehen" }));
    expect(testPref("intro.gesehen")).toBe(false);
    expect(screen.getByText("Dorf")).toBeInTheDocument();
  });

  it("replay clears a local dismissal so the tour shows again", () => {
    dismissIntro();
    expect(sessionStorage.getItem("guitar.intro.dismissed")).toBe("1");
    resetTestPrefs({ "intro.gesehen": true });
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    fireEvent.click(screen.getByRole("button", { name: "Intro erneut ansehen" }));
    expect(sessionStorage.getItem("guitar.intro.dismissed")).toBeNull();
    expect(testPref("intro.gesehen")).toBe(false);
  });
});
