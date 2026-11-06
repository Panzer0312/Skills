import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useInputDevices } from "./useInputDevices.js";

function stubDevices(list: { deviceId: string; label: string; kind: string }[]) {
  vi.stubGlobal("navigator", {
    mediaDevices: {
      enumerateDevices: vi.fn(async () => list),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    },
  });
}

beforeEach(() => localStorage.clear());
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useInputDevices", () => {
  it("lists devices without labels as Eingang 1", async () => {
    stubDevices([
      { deviceId: "a", label: "", kind: "audioinput" },
      { deviceId: "v", label: "Cam", kind: "videoinput" },
      { deviceId: "b", label: "", kind: "audioinput" },
    ]);
    const { result } = renderHook(() => useInputDevices());
    await waitFor(() => expect(result.current.devices).toHaveLength(2));
    expect(result.current.devices).toEqual([
      { id: "a", label: "Eingang 1" },
      { id: "b", label: "Eingang 2" },
    ]);
  });

  it("shows real labels after a refresh", async () => {
    const list = [{ deviceId: "a", label: "", kind: "audioinput" }];
    stubDevices(list);
    const { result } = renderHook(() => useInputDevices());
    await waitFor(() => expect(result.current.devices[0]?.label).toBe("Eingang 1"));
    list[0]!.label = "Focusrite";
    await act(() => result.current.refresh());
    expect(result.current.devices[0]?.label).toBe("Focusrite");
  });

  it("stores the choice per browser", async () => {
    stubDevices([]);
    const { result } = renderHook(() => useInputDevices());
    act(() => result.current.select("a"));
    expect(result.current.deviceId).toBe("a");
    expect(localStorage.getItem("audio.inputDevice")).toBe("a");
    act(() => result.current.select(null));
    expect(localStorage.getItem("audio.inputDevice")).toBeNull();
  });

  it("keeps working when localStorage throws", async () => {
    stubDevices([]);
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    const { result } = renderHook(() => useInputDevices());
    expect(result.current.deviceId).toBeNull();
    act(() => result.current.select("a"));
    expect(result.current.deviceId).toBe("a");
  });
});
