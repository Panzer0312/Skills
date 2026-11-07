import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

const setGuitar = vi.fn();
const setStored = vi.fn();
let guitar = "ja";
vi.mock("../usePref.js", () => ({
  usePref: (key: string) =>
    key === "geraete.gitarreAmMikro" ? [guitar, setGuitar, { loading: false }] : [null, setStored, { loading: false }],
}));
const start = vi.fn();
const stop = vi.fn();
vi.mock("../../../../packages/web/src/audio/useMicrophone.js", () => ({
  useMicrophone: () => ({ state: "idle", error: null, start, stop }),
}));
vi.mock("../../../../packages/web/src/audio/useInputDevices.js", () => ({
  useInputDevices: () => ({ devices: [], deviceId: "dev-1", select: vi.fn(), refresh: vi.fn() }),
}));
import { DeviceCheck } from "./DeviceCheck.js";
import { RequireDevice } from "./RequireDevice.js";

afterEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("DeviceCheck", () => {
  it("device check stores the choice", () => {
    guitar = "ja";
    render(<DeviceCheck />);
    fireEvent.click(screen.getByLabelText("Nein, ohne Gerät üben"));
    expect(setGuitar).toHaveBeenCalledWith("nein");
    fireEvent.click(screen.getByRole("button", { name: "Passt" }));
    expect(setStored).toHaveBeenCalledWith("dev-1");
  });

  it("shows the no-device line for nein", () => {
    guitar = "nein";
    render(<DeviceCheck />);
    expect(screen.getByText(/Alles funktioniert auch ohne Gerät/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Pegel testen" })).toBeNull();
  });

  it("level test stops after 5 seconds", () => {
    vi.useFakeTimers();
    guitar = "ja";
    render(<DeviceCheck />);
    fireEvent.click(screen.getByRole("button", { name: "Pegel testen" }));
    expect(start).toHaveBeenCalledTimes(1);
    const stopsBefore = stop.mock.calls.length;
    act(() => vi.advanceTimersByTime(4900));
    expect(stop.mock.calls.length).toBe(stopsBefore);
    act(() => vi.advanceTimersByTime(200));
    expect(stop.mock.calls.length).toBeGreaterThan(stopsBefore);
  });
});

describe("RequireDevice", () => {
  it("RequireDevice renders fallback without a device", () => {
    guitar = "nein";
    render(
      <RequireDevice what="mic" fallback={<p>ohne</p>}>
        <p>mit</p>
      </RequireDevice>,
    );
    expect(screen.getByText("ohne")).toBeTruthy();
    expect(screen.queryByText("mit")).toBeNull();
  });
});
