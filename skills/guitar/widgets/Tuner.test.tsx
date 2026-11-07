import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resetTestPrefs, testPref } from "../game/testPrefs.js";
import Tuner from "./Tuner.js";

vi.mock("../game/usePref.js", async () => ({ usePref: (await import("../game/testPrefs.js")).usePref }));

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

const mocks = vi.hoisted(() => ({ state: "idle" as string, error: null as string | null, start: vi.fn() }));
const playReferenceTone = vi.hoisted(() => vi.fn());

vi.mock("../../../packages/web/src/audio/useMicrophone.js", () => ({
  useMicrophone: () => ({ state: mocks.state, error: mocks.error, start: mocks.start, stop: vi.fn() }),
}));

vi.mock("../../../packages/web/src/audio/useInputDevices.js", () => ({
  useInputDevices: () => ({ devices: [], deviceId: null, select: vi.fn(), refresh: vi.fn(async () => {}) }),
}));

vi.mock("../../../packages/web/src/audio/referenceTone.js", () => ({ playReferenceTone }));

describe("Tuner", () => {
  beforeEach(() => resetTestPrefs());

  it("offers to start the microphone", async () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    await userEvent.click(screen.getByRole("button", { name: /Stimmgerät starten/ }));
    expect(mocks.start).toHaveBeenCalled();
  });

  it("explains a denied permission without hiding the rest", () => {
    mocks.state = "denied";
    mocks.error = "Der Zugriff auf das Mikrofon wurde abgelehnt.";
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    expect(screen.getByText(/abgelehnt/)).toBeInTheDocument();
    expect(screen.getByLabelText(/Stimmung/)).toBeInTheDocument();
  });

  it("lets the user pick a tuning", async () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Stimmung/), "Drop D");
    expect(screen.getByText("D2")).toBeInTheDocument();
  });

  it("shows the B string as H", () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    expect(screen.getByRole("button", { name: "H3 anspielen" })).toBeInTheDocument();
  });

  it("plays a reference tone for the clicked string", async () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    await userEvent.click(screen.getByRole("button", { name: "E2 anspielen" }));
    expect(playReferenceTone).toHaveBeenCalledWith("E2");
  });

  it("exposes an adjustable noise floor", async () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    expect(screen.getByLabelText(/Rauschschwelle/)).toBeInTheDocument();
  });

  it("opens with the tuning asked for", () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} initialTuning="Drop D" />);
    expect(screen.getByLabelText(/Stimmung/)).toHaveValue("Drop D");
  });

  it("falls back to Standard for an unknown tuning", () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} initialTuning="Nirgendwo" />);
    expect(screen.getByLabelText(/Stimmung/)).toHaveValue("Standard");
  });

  it("offers the input picker and a level meter", () => {
    mocks.state = "running";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    expect(screen.getByRole("meter", { name: "Eingangspegel" })).toBeInTheDocument();
    expect(screen.getByLabelText("Eingang")).toBeInTheDocument();
  });

  it("tuner url tuning beats stored tuning", () => {
    resetTestPrefs({ "werkzeuge.stimmgeraet.stimmung": "Drop D" });
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} initialTuning="Standard" />);
    expect(screen.getByLabelText(/Stimmung/)).toHaveValue("Standard");
  });

  it("tuner restores stored tuning", async () => {
    mocks.state = "idle";
    mocks.error = null;
    resetTestPrefs({ "werkzeuge.stimmgeraet.stimmung": "Drop D" });
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    expect(screen.getByLabelText(/Stimmung/)).toHaveValue("Drop D");
  });

  it("stores a picked tuning", async () => {
    mocks.state = "idle";
    mocks.error = null;
    render(<Tuner data={[]} progress={progress} settings={{}} />);
    await userEvent.selectOptions(screen.getByLabelText(/Stimmung/), "Drop D");
    expect(testPref("werkzeuge.stimmgeraet.stimmung")).toBe("Drop D");
  });
});
