import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import Tuner from "./Tuner.js";

const progress = { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };

const mocks = vi.hoisted(() => ({ state: "idle" as string, error: null as string | null, start: vi.fn() }));
const playReferenceTone = vi.hoisted(() => vi.fn());

vi.mock("../../../packages/web/src/audio/useMicrophone.js", () => ({
  useMicrophone: () => ({ state: mocks.state, error: mocks.error, start: mocks.start, stop: vi.fn() }),
}));

vi.mock("../../../packages/web/src/audio/referenceTone.js", () => ({ playReferenceTone }));

describe("Tuner", () => {
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
});
