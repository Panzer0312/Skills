import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetronome } from "./useMetronome.js";

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal(
    "AudioContext",
    class {
      currentTime = 0;
      destination = {};
      state = "running";
      createOscillator() {
        return { frequency: { value: 0 }, connect: vi.fn(), start: vi.fn(), stop: vi.fn() };
      }
      createGain() {
        return { gain: { value: 0, setValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn() }, connect: vi.fn() };
      }
      close = vi.fn(async () => {});
      resume = vi.fn(async () => {});
    },
  );
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("useMetronome", () => {
  it("defaults to 80 bpm in four four", () => {
    const { result } = renderHook(() => useMetronome());
    expect(result.current.bpm).toBe(80);
    expect(result.current.beatsPerBar).toBe(4);
    expect(result.current.running).toBe(false);
  });

  it("clamps the tempo to a sane range", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.setBpm(5));
    expect(result.current.bpm).toBe(20);
    act(() => result.current.setBpm(500));
    expect(result.current.bpm).toBe(300);
  });

  it("derives the tempo from tap intervals", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.tap());
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.tap();
    });
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.tap();
    });
    expect(result.current.bpm).toBeGreaterThan(110);
    expect(result.current.bpm).toBeLessThan(130);
  });

  it("toggles running state", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.start());
    expect(result.current.running).toBe(true);
    act(() => result.current.stop());
    expect(result.current.running).toBe(false);
  });
});
