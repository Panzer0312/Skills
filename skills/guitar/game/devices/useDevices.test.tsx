import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let guitar = "ja";
vi.mock("../usePref.js", () => ({ usePref: () => [guitar, vi.fn(), { loading: false }] }));
import { useDevices } from "./useDevices.js";

function stubNav(state?: string) {
  vi.stubGlobal("navigator", {
    mediaDevices: { getUserMedia: vi.fn() },
    permissions: state ? { query: vi.fn(async () => ({ state, onchange: null })) } : undefined,
  });
}
afterEach(() => vi.unstubAllGlobals());

describe("useDevices", () => {
  it("canUse mic is false unless guitar is ja", async () => {
    stubNav("granted");
    guitar = "nein";
    const { result, rerender } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.mic).toBe("ok"));
    expect(result.current.canUse("mic")).toBe(false);
    guitar = "spaeter";
    rerender();
    expect(result.current.canUse("mic")).toBe(false);
    guitar = "ja";
    rerender();
    expect(result.current.canUse("mic")).toBe(true);
  });

  it("denied permission blocks mic", async () => {
    stubNav("denied");
    guitar = "ja";
    const { result } = renderHook(() => useDevices());
    await waitFor(() => expect(result.current.mic).toBe("denied"));
    expect(result.current.canUse("mic")).toBe(false);
  });

  it("missing permissions API is unknown and does not throw", () => {
    stubNav();
    guitar = "ja";
    const { result } = renderHook(() => useDevices());
    expect(result.current.mic).toBe("unknown");
    expect(result.current.canUse("mic")).toBe(true);
  });
});
