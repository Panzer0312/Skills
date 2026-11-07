import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const BASE = "/vollbild/guitar/spiel";
vi.mock("../usePref.js", async () => ({ usePref: (await import("../testPrefs.js")).usePref }));

import { resetTestPrefs } from "../testPrefs.js";
import { ambienceAllowed } from "./ambience.js";
import { playEffect, setSoundEnabled } from "./effects.js";
import { setFreeTimerRunning } from "../freeTimerStore.js";
import { useAmbience } from "./useAmbience.js";

class FakeNode {
  gain = { value: 1, setValueAtTime: vi.fn(), linearRampToValueAtTime: vi.fn(), exponentialRampToValueAtTime: vi.fn(), cancelScheduledValues: vi.fn() };
  frequency = { value: 0 };
  connect = vi.fn();
  disconnect = vi.fn();
  start = vi.fn();
  stop = vi.fn();
  getChannelData = () => new Float32Array(8);
}
let contexts: FakeCtx[] = [];
let initialState: "running" | "suspended" = "running";
class FakeCtx {
  state = initialState;
  currentTime = 0;
  sampleRate = 8000;
  destination = new FakeNode();
  resume = vi.fn(async () => {
    this.state = "running";
  });
  close = vi.fn(async () => undefined);
  createGain = vi.fn(() => new FakeNode());
  createBufferSource = vi.fn(() => new FakeNode());
  createBiquadFilter = vi.fn(() => new FakeNode());
  createOscillator = vi.fn(() => new FakeNode());
  createBuffer = vi.fn(() => new FakeNode());
  constructor() {
    contexts.push(this);
  }
}

let nav: (to: string) => void = () => undefined;
function Probe() {
  useAmbience();
  nav = useNavigate();
  return null;
}
const mount = (path = BASE) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Probe />
    </MemoryRouter>,
  );
const go = (to: string) => act(() => nav(to));
const started = () => contexts.reduce((n, c) => n + c.createBufferSource.mock.calls.length, 0);

beforeEach(() => {
  vi.useFakeTimers();
  contexts = [];
  initialState = "running";
  resetTestPrefs({ "klang.an": true });
  vi.stubGlobal("AudioContext", FakeCtx);
});
afterEach(() => {
  cleanup();
  setFreeTimerRunning(false);
  setSoundEnabled(false);
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("ambienceAllowed", () => {
  it.each(["", "/markt", "/bibliothek", "/bibliothek/x", "/hafen", "/hafen/x", "/chronik", "/"])(
    "allows %j",
    (rest) => expect(ambienceAllowed(BASE + rest)).toBe(true),
  );
  it.each(["/quests", "/quest/x", "/taverne", "/schrein", "/schmiede", "/griffbrett", "/riffs", "/jam", "/einstufung", "/unbekannt"])(
    "blocks %s",
    (rest) => expect(ambienceAllowed(BASE + rest)).toBe(false),
  );
  it("blocks outside the game", () => expect(ambienceAllowed("/")).toBe(false));
});

describe("useAmbience", () => {
  it("never builds a context while sound is off", () => {
    resetTestPrefs({ "klang.an": false });
    mount();
    expect(contexts).toHaveLength(0);
  });

  it("starts at the village, stops on quest, restarts on return", () => {
    mount();
    expect(started()).toBe(1);
    const master = contexts[0]!.createGain.mock.results[0]!.value as FakeNode;
    go(`${BASE}/quest/x`);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.3);
    act(() => vi.advanceTimersByTime(400));
    expect(master.disconnect).toHaveBeenCalled();
    go(BASE);
    expect(started()).toBe(2);
    expect(contexts).toHaveLength(1);
  });

  it.each(["schrein", "jam"])("stops on %s", (p) => {
    mount();
    const master = contexts[0]!.createGain.mock.results[0]!.value as FakeNode;
    go(`${BASE}/${p}`);
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.3);
  });

  it("stops while the free practice timer runs and returns after it", () => {
    mount();
    expect(started()).toBe(1);
    const master = contexts[0]!.createGain.mock.results[0]!.value as FakeNode;
    act(() => setFreeTimerRunning(true));
    expect(master.gain.linearRampToValueAtTime).toHaveBeenLastCalledWith(0, 0.3);
    act(() => setFreeTimerRunning(false));
    expect(started()).toBe(2);
  });

  it("stays silent when the page opens with a running free timer", () => {
    setFreeTimerRunning(true);
    mount();
    expect(started()).toBe(0);
  });

  it("does not resume on return when sound was turned off", () => {
    const { rerender } = mount();
    expect(started()).toBe(1);
    go(`${BASE}/quest/x`);
    act(() => resetTestPrefs({ "klang.an": false }));
    rerender(
      <MemoryRouter initialEntries={[BASE]}>
        <Probe />
      </MemoryRouter>,
    );
    go(BASE);
    expect(started()).toBe(1);
  });

  it("suspended context: resumes on first keydown and removes both listeners", () => {
    initialState = "suspended";
    mount();
    const ctx = contexts[0]!;
    act(() => {
      document.dispatchEvent(new Event("keydown"));
    });
    expect(ctx.resume).toHaveBeenCalledTimes(1);
    act(() => {
      document.dispatchEvent(new Event("keydown"));
      document.dispatchEvent(new Event("pointerdown"));
    });
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("suspended context: no throw, resumes on first pointerdown", () => {
    initialState = "suspended";
    mount();
    const ctx = contexts[0]!;
    expect(ctx.resume).not.toHaveBeenCalled();
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    expect(ctx.resume).toHaveBeenCalledTimes(1);
  });

  it("closes the context on unmount", () => {
    const { unmount } = mount();
    unmount();
    act(() => vi.advanceTimersByTime(500));
    expect(contexts[0]!.close).toHaveBeenCalled();
  });
});

describe("playEffect", () => {
  it("does nothing while disabled", () => {
    playEffect("coin");
    playEffect("equip");
    expect(contexts).toHaveLength(0);
  });
  it("plays on its own context and closes it when enabled", () => {
    setSoundEnabled(true);
    playEffect("coin");
    expect(contexts).toHaveLength(1);
    expect(contexts[0]!.createOscillator).toHaveBeenCalledTimes(2);
    vi.advanceTimersByTime(500);
    expect(contexts[0]!.close).toHaveBeenCalled();
  });
});
