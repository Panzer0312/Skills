import { afterEach, describe, expect, it, vi } from "vitest";
import { playClick, playSignal } from "./signalTone.js";

afterEach(() => vi.unstubAllGlobals());

describe("playSignal", () => {
  it("closes the context when the oscillator setup throws", () => {
    const close = vi.fn(async () => undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        close = close;
        createOscillator() {
          throw new Error("no oscillator");
        }
      },
    );
    expect(() => playSignal("start")).not.toThrow();
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("playClick", () => {
  function stubContext() {
    const frequencies: number[] = [];
    const close = vi.fn(async () => undefined);
    vi.stubGlobal(
      "AudioContext",
      class {
        currentTime = 0;
        destination = {};
        close = close;
        createGain() {
          return {
            gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
            connect() {},
          };
        }
        createOscillator() {
          return {
            type: "",
            frequency: {
              set value(v: number) {
                frequencies.push(v);
              },
            },
            connect() {},
            start() {},
            stop() {},
            onended: null,
          };
        }
      },
    );
    return { frequencies, close };
  }

  it("uses 1600 Hz for the accent and 900 Hz otherwise", () => {
    const { frequencies } = stubContext();
    playClick(true);
    playClick(false);
    expect(frequencies).toEqual([1600, 900]);
  });

  it("does not throw without audio", () => {
    vi.stubGlobal("AudioContext", undefined);
    expect(() => playClick(true)).not.toThrow();
  });
});
