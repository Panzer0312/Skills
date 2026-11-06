import { act, renderHook } from "@testing-library/react";
import { createElement, StrictMode, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useJamEngine } from "./useJamEngine.js";

const { log } = vi.hoisted(() => ({ log: vi.fn() }));
vi.mock("../api.js", () => ({ gameApi: { log } }));

let audioNow = 0;
let sources = 0;
let oscillators = 0;
let closed = 0;
let gains: { gain: { value: number } }[] = [];

function play(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    audioNow += 0.025;
    act(() => {
      vi.advanceTimersByTime(25);
    });
  }
}

const param = () => ({
  value: 0,
  setValueAtTime: vi.fn(),
  exponentialRampToValueAtTime: vi.fn(),
  linearRampToValueAtTime: vi.fn(),
});

beforeEach(() => {
  audioNow = 0;
  sources = 0;
  oscillators = 0;
  closed = 0;
  gains = [];
  log.mockReset();
  log.mockResolvedValue({ xpGained: 0, suggestion: null, isRecord: false });
  vi.useFakeTimers();
  vi.stubGlobal(
    "AudioContext",
    class {
      get currentTime() {
        return audioNow;
      }
      sampleRate = 8000;
      destination = {};
      state = "running";
      createOscillator() {
        oscillators += 1;
        const osc = {
          type: "sine",
          frequency: param(),
          connect: vi.fn(),
          start: vi.fn(),
          stop: vi.fn(),
        };
        return osc;
      }
      createGain() {
        const node = { gain: param(), connect: vi.fn() };
        gains.push(node);
        return node;
      }
      createBuffer(_channels: number, length: number) {
        return { getChannelData: () => new Float32Array(length) };
      }
      createBufferSource() {
        sources += 1;
        return { buffer: null, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createBiquadFilter() {
        return { type: "", frequency: param(), Q: param(), connect: vi.fn() };
      }
      close = vi.fn(async () => {
        closed += 1;
      });
      resume = vi.fn(async () => {});
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const base = { root: "E", style: "rock" as const, bpm: 90, volume: 0.7 };

describe("useJamEngine", () => {
  it("schedules a bar's hits", () => {
    const { result } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    play(2.5);
    // One rock bar at 90 bpm lasts 2.67 s: 2 snares and 8 hats, 3 kicks and 8 bass notes.
    expect(result.current.running).toBe(true);
    expect(sources).toBe(10);
    expect(oscillators).toBe(11);
    expect(result.current.chord).toBe("Em");
    expect(result.current.nextChord).toBe("C");
  });

  it("applies a new style at the next bar, not mid-bar", () => {
    const { result, rerender } = renderHook((props) => useJamEngine(props), { initialProps: base });
    act(() => result.current.start());
    play(0.5);
    const mid = oscillators;
    rerender({ ...base, style: "metal" });
    play(0.5);
    // Rock bass plays eighth notes (one every 0.33 s); a metal gallop would add many more.
    expect(oscillators - mid).toBeLessThanOrEqual(8);
    expect(result.current.chord).toBe("Em");
    play(2.5);
    expect(result.current.chord).toBe("E5");
  });

  it("closes the audio context on stop and on unmount", () => {
    const { result, unmount } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => result.current.stop());
    expect(closed).toBe(1);
    expect(result.current.running).toBe(false);
    act(() => result.current.start());
    unmount();
    expect(closed).toBe(2);
  });

  it("logs the time once on stop", () => {
    const { result, unmount } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    act(() => result.current.stop());
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 90, level: 1, techniqueId: "jam" });
    unmount();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("logs on unmount while playing", () => {
    const { result, unmount } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    unmount();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 120, level: 1, techniqueId: "jam" });
  });

  it("logs on unmount while playing inside StrictMode", () => {
    const wrapper = ({ children }: { children: ReactNode }) => createElement(StrictMode, null, children);
    const { result, unmount } = renderHook(() => useJamEngine(base), { wrapper });
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(75_000);
    });
    unmount();
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 75, level: 1, techniqueId: "jam" });
  });

  it("logs nothing under one minute", () => {
    const { result } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(59_000);
    });
    act(() => result.current.stop());
    expect(log).not.toHaveBeenCalled();
  });

  it("stops by itself after an hour and logs 3600 seconds", () => {
    const { result, unmount } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(3_700_000);
    });
    expect(result.current.running).toBe(false);
    expect(closed).toBe(1);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ kind: "frei", seconds: 3600, level: 1, techniqueId: "jam" });
    unmount();
    expect(log).toHaveBeenCalledTimes(1);
  });

  it("survives a failed log", async () => {
    log.mockRejectedValue(new Error("offline"));
    const { result } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    act(() => {
      vi.advanceTimersByTime(90_000);
    });
    act(() => result.current.stop());
    await vi.advanceTimersByTimeAsync(0);
    expect(result.current.running).toBe(false);
    expect(closed).toBe(1);
  });
  it("keeps the master gain low enough for the loudest step at full volume", () => {
    const { result, rerender } = renderHook((props) => useJamEngine(props), {
      initialProps: { ...base, volume: 1 },
    });
    act(() => result.current.start());
    expect(gains[0]!.gain.value).toBeCloseTo(0.65);
    rerender({ ...base, volume: 0.5 });
    expect(gains[0]!.gain.value).toBeCloseTo(0.325);
  });

  it("stays stopped and reports a German error when the audio context throws", () => {
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          throw new Error("no audio");
        }
      },
    );
    const { result } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    expect(result.current.running).toBe(false);
    expect(result.current.error).toMatch(/Ton/);
  });

  it("closes the context when setup fails after it opened", () => {
    const close = vi.fn(async () => {});
    vi.stubGlobal(
      "AudioContext",
      class {
        close = close;
        resume = vi.fn(async () => {});
        createGain() {
          throw new Error("broken");
        }
      },
    );
    const { result } = renderHook(() => useJamEngine(base));
    act(() => result.current.start());
    expect(close).toHaveBeenCalledTimes(1);
    expect(result.current.running).toBe(false);
    expect(result.current.error).not.toBeNull();
  });
});
