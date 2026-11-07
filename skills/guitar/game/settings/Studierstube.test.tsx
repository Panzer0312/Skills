import { PREFS, type PrefGroup } from "@skills/core";
import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../../packages/web/src/app/queryClient.js";
import { gameApi } from "../api.js";
import { prefWrites, resetTestPrefs, testPref } from "../testPrefs.js";
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

  it("reset one field restores the default", () => {
    resetTestPrefs({ "freiUeben.nachfragenAbMinuten": 30 });
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Üben" }));
    fireEvent.click(screen.getByRole("button", { name: "Zurücksetzen" }));
    expect(testPref("freiUeben.nachfragenAbMinuten")).toBe(90);
  });

  it("embeds the device check in the Geräte tab", () => {
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Geräte" }));
    expect(screen.getByText("Geraetepruefung")).toBeInTheDocument();
  });

  it("reset all asks first", async () => {
    const reset = vi.spyOn(gameApi, "resetPrefs").mockResolvedValue({ ok: true });
    const confirm = vi.spyOn(window, "confirm").mockReturnValueOnce(false).mockReturnValueOnce(true);
    screenUnderTest();
    fireEvent.click(screen.getByRole("tab", { name: "Daten" }));
    fireEvent.click(screen.getByRole("button", { name: "Alle Einstellungen zurücksetzen" }));
    expect(reset).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Alle Einstellungen zurücksetzen" }));
    await waitFor(() => expect(reset).toHaveBeenCalledTimes(1));
    expect(confirm).toHaveBeenCalledTimes(2);
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
});
