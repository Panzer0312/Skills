import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMicrophone } from "./useMicrophone.js";

function stubAudio(getUserMedia: () => Promise<MediaStream>) {
  vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
  vi.stubGlobal(
    "AudioContext",
    class {
      sampleRate = 44_100;
      state = "running";
      createMediaStreamSource() {
        return { connect: vi.fn(), disconnect: vi.fn() };
      }
      createAnalyser() {
        return {
          fftSize: 2048,
          connect: vi.fn(),
          disconnect: vi.fn(),
          getFloatTimeDomainData: (target: Float32Array) => target.fill(0.5),
        };
      }
      close = vi.fn(async () => {});
    },
  );
}

afterEach(() => vi.unstubAllGlobals());

describe("useMicrophone", () => {
  it("starts idle", () => {
    stubAudio(async () => ({ getTracks: () => [] }) as unknown as MediaStream);
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    expect(result.current.state).toBe("idle");
  });

  it("reaches running after permission is granted", async () => {
    stubAudio(async () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream);
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("running"));
  });

  it("reports a denied permission in German without throwing", async () => {
    stubAudio(async () => {
      const error = new Error("Permission denied");
      error.name = "NotAllowedError";
      throw error;
    });
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("denied"));
    expect(result.current.error).toMatch(/Mikrofon/);
  });

  it("reports an unsupported environment", async () => {
    vi.stubGlobal("navigator", {});
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("unsupported"));
  });
});
