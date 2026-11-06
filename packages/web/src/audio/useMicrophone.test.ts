import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useMicrophone } from "./useMicrophone.js";

function stubAudio(getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>) {
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

describe("useMicrophone devices", () => {
  const stream = () => ({ getTracks: () => [{ stop: vi.fn() }] }) as unknown as MediaStream;

  it("asks for the chosen device with processing off", async () => {
    const getUserMedia = vi.fn(async () => stream());
    stubAudio(getUserMedia);
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn(), deviceId: "x" }));
    await result.current.start();
    expect(getUserMedia).toHaveBeenCalledWith({
      audio: { deviceId: { exact: "x" }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  });

  it("falls back to the default device when the chosen one is gone", async () => {
    const getUserMedia = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockImplementationOnce(async () => {
        const error = new Error("gone");
        error.name = "OverconstrainedError";
        throw error;
      })
      .mockImplementation(async () => stream());
    stubAudio(getUserMedia);
    const onDeviceLost = vi.fn();
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn(), deviceId: "x", onDeviceLost }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("running"));
    expect(onDeviceLost).toHaveBeenCalledTimes(1);
    expect(getUserMedia).toHaveBeenCalledTimes(2);
    expect(getUserMedia.mock.calls[1]![0]).toEqual({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    expect(result.current.error).toBe("Das gewählte Eingabegerät ist nicht da. Das Standardgerät wird benutzt.");
  });

  it("restarts on the new device while running", async () => {
    const getUserMedia = vi.fn(async (_: MediaStreamConstraints) => stream());
    stubAudio(getUserMedia);
    const { result, rerender } = renderHook(({ id }) => useMicrophone({ onBuffer: vi.fn(), deviceId: id }), {
      initialProps: { id: "a" },
    });
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("running"));
    rerender({ id: "b" });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.calls[1]![0]).toEqual({
      audio: { deviceId: { exact: "b" }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await waitFor(() => expect(result.current.state).toBe("running"));
  });
});

describe("useMicrophone lifecycle", () => {
  interface FakeTrack {
    stop: ReturnType<typeof vi.fn>;
    onended: (() => void) | null;
  }
  const track = (): FakeTrack => ({ stop: vi.fn(), onended: null });
  const streamOf = (t: FakeTrack) => ({ getTracks: () => [t] }) as unknown as MediaStream;
  const deferred = () => {
    let resolve!: (stream: MediaStream) => void;
    const promise = new Promise<MediaStream>((r) => {
      resolve = r;
    });
    return { promise, resolve };
  };

  it("restarts on the default device when the track ends", async () => {
    const first = track();
    const second = track();
    const getUserMedia = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockResolvedValueOnce(streamOf(first))
      .mockResolvedValue(streamOf(second));
    stubAudio(getUserMedia);
    const onDeviceLost = vi.fn();
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn(), deviceId: "x", onDeviceLost }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("running"));
    act(() => first.onended?.());
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(first.stop).toHaveBeenCalled();
    expect(onDeviceLost).toHaveBeenCalledTimes(1);
    expect(getUserMedia.mock.calls[1]![0]).toEqual({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await waitFor(() => expect(result.current.state).toBe("running"));
    expect(result.current.error).toBe("Das gewählte Eingabegerät ist nicht da. Das Standardgerät wird benutzt.");
  });

  it("stops the stream of a stale request after a double start", async () => {
    const a = track();
    const b = track();
    const one = deferred();
    const two = deferred();
    const getUserMedia = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockReturnValueOnce(one.promise)
      .mockReturnValueOnce(two.promise);
    stubAudio(getUserMedia);
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    let p1!: Promise<void>;
    let p2!: Promise<void>;
    act(() => {
      p1 = result.current.start();
      p2 = result.current.start();
    });
    await act(async () => {
      one.resolve(streamOf(a));
      two.resolve(streamOf(b));
      await Promise.all([p1, p2]);
    });
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).not.toHaveBeenCalled();
    expect(result.current.state).toBe("running");
  });

  it("stops a stream that arrives after unmount without a frame loop", async () => {
    const t = track();
    const pending = deferred();
    stubAudio(() => pending.promise);
    const raf = vi.spyOn(globalThis, "requestAnimationFrame");
    const { result, unmount } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    let p!: Promise<void>;
    act(() => {
      p = result.current.start();
    });
    unmount();
    await act(async () => {
      pending.resolve(streamOf(t));
      await p;
    });
    expect(t.stop).toHaveBeenCalled();
    expect(raf).not.toHaveBeenCalled();
    raf.mockRestore();
  });

  it("drops a stale request when the device changes while requesting", async () => {
    const a = track();
    const b = track();
    const one = deferred();
    const two = deferred();
    const getUserMedia = vi
      .fn<(c: MediaStreamConstraints) => Promise<MediaStream>>()
      .mockReturnValueOnce(one.promise)
      .mockReturnValueOnce(two.promise);
    stubAudio(getUserMedia);
    const { result, rerender } = renderHook(({ id }) => useMicrophone({ onBuffer: vi.fn(), deviceId: id }), {
      initialProps: { id: "a" },
    });
    act(() => {
      void result.current.start();
    });
    rerender({ id: "b" });
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
    expect(getUserMedia.mock.calls[1]![0]).toEqual({
      audio: { deviceId: { exact: "b" }, echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
    await act(async () => {
      one.resolve(streamOf(a));
      two.resolve(streamOf(b));
    });
    await waitFor(() => expect(result.current.state).toBe("running"));
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).not.toHaveBeenCalled();
  });

  it("recognises an error by its name even when it is not an Error", async () => {
    stubAudio(async () => {
      throw { name: "NotAllowedError" };
    });
    const { result } = renderHook(() => useMicrophone({ onBuffer: vi.fn() }));
    await result.current.start();
    await waitFor(() => expect(result.current.state).toBe("denied"));
  });
});
