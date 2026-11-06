import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useMetronome } from "./useMetronome.js";

let audioNow = 0;
let started = 0;

/** Moves the fake audio clock and the timers forward together, 25 ms at a time. */
function play(seconds: number) {
  for (let elapsed = 0; elapsed < seconds; elapsed += 0.025) {
    audioNow += 0.025;
    act(() => {
      vi.advanceTimersByTime(25);
    });
  }
}

beforeEach(() => {
  audioNow = 0;
  started = 0;
  vi.useFakeTimers();
  vi.stubGlobal(
    "AudioContext",
    class {
      get currentTime() {
        return audioNow;
      }
      destination = {};
      state = "running";
      createOscillator() {
        return {
          frequency: { value: 0 },
          connect: vi.fn(),
          start: vi.fn(() => {
            started += 1;
          }),
          stop: vi.fn(),
        };
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

  it("plays subdivisions between the beats", () => {
    const quarter = renderHook(() => useMetronome());
    act(() => quarter.result.current.start());
    play(2);
    quarter.unmount();
    const quarterCount = started;

    started = 0;
    audioNow = 0;
    const eighth = renderHook(() => useMetronome());
    act(() => eighth.result.current.setSubdivision("achtel"));
    act(() => eighth.result.current.start());
    play(2);
    expect(started).toBeGreaterThan(quarterCount);
  });

  it("raises the tempo bar by bar with the speed trainer", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.setBpm(60));
    act(() => result.current.setSpeedTrainer({ startBpm: 60, targetBpm: 68, stepBpm: 4, everyBars: 1 }));
    act(() => result.current.start());
    const seen: number[] = [];
    for (let i = 0; i < 8; i += 1) {
      play(1);
      seen.push(result.current.bpm);
    }
    expect(Math.max(...seen)).toBe(68);
    expect(seen).toEqual([...seen].sort((a, b) => a - b));
  });

  it("ends the speed trainer when the tempo is set by hand", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.setSpeedTrainer({ startBpm: 60, targetBpm: 68, stepBpm: 4, everyBars: 1 }));
    act(() => result.current.start());
    act(() => result.current.setBpm(100));
    expect(result.current.speedTrainer).toBeNull();
    expect(result.current.bpm).toBe(100);
  });

  it("ends the speed trainer on tap", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.setSpeedTrainer({ startBpm: 60, targetBpm: 68, stepBpm: 4, everyBars: 1 }));
    act(() => result.current.tap());
    act(() => {
      vi.advanceTimersByTime(500);
      result.current.tap();
    });
    expect(result.current.speedTrainer).toBeNull();
  });

  it("resets accents when the beats per bar change", () => {
    const { result } = renderHook(() => useMetronome());
    act(() => result.current.toggleAccent(2));
    expect(result.current.accents).toEqual([true, false, true, false]);
    act(() => result.current.setBeatsPerBar(3));
    expect(result.current.accents).toEqual([true, false, false]);
  });
});
