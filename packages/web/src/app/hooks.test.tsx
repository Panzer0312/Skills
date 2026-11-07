import { afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { useWakeLock } from "./useWakeLock";
import { usePersistentState } from "./usePersistentState";
import { usePracticeKeys } from "./usePracticeKeys";

const isNumber = (raw: unknown): raw is number => typeof raw === "number";

afterEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  delete (navigator as unknown as { wakeLock?: unknown }).wakeLock;
});

function mockWakeLock() {
  const release = vi.fn(() => Promise.resolve());
  const request = vi.fn(() => Promise.resolve({ release, released: false }));
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  return { request, release };
}

function setVisibility(state: "visible" | "hidden") {
  Object.defineProperty(document, "visibilityState", { value: state, configurable: true });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("useWakeLock", () => {
  afterEach(() => {
    delete (document as unknown as { visibilityState?: unknown }).visibilityState;
  });

  it("wake lock requests when active and releases when inactive", async () => {
    const { request, release } = mockWakeLock();
    const { rerender } = renderHook(({ a }) => useWakeLock(a), { initialProps: { a: true } });
    await act(async () => {});
    expect(request).toHaveBeenCalledWith("screen");
    rerender({ a: false });
    await act(async () => {});
    expect(release).toHaveBeenCalled();
  });

  it("wake lock without API does nothing and does not throw", () => {
    expect(() => renderHook(() => useWakeLock(true))).not.toThrow();
  });

  it("visibilitychange re-requests only when no lock is held", async () => {
    const release = vi.fn(() => Promise.resolve());
    const held = { release, released: false };
    const request = vi
      .fn()
      .mockResolvedValueOnce(held)
      .mockResolvedValue({ release, released: false });
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    // a lock is still held: returning to the tab must not ask twice
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);

    // the browser dropped the lock while hidden: request again
    held.released = true;
    act(() => setVisibility("hidden"));
    act(() => setVisibility("visible"));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(2);
  });

  it("visibilitychange does not request while a request is still pending", async () => {
    const request = vi.fn(() => new Promise<never>(() => {}));
    Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
    renderHook(() => useWakeLock(true));
    expect(request).toHaveBeenCalledTimes(1);
    act(() => setVisibility("visible"));
    expect(request).toHaveBeenCalledTimes(1);
  });

  it("wake lock releases on unmount", async () => {
    const { request, release } = mockWakeLock();
    const { unmount } = renderHook(() => useWakeLock(true));
    await act(async () => {});
    expect(request).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {});
    expect(release).toHaveBeenCalledTimes(1);
  });
});

describe("usePersistentState", () => {
  it("persistent state falls back on invalid stored value", () => {
    localStorage.setItem("k", '"x"');
    const { result } = renderHook(() => usePersistentState("k", 5, isNumber));
    expect(result.current[0]).toBe(5);
  });

  it("persistent state writes and survives remount", () => {
    const first = renderHook(() => usePersistentState("k", 5, isNumber));
    act(() => first.result.current[1](9));
    expect(first.result.current[0]).toBe(9);
    first.unmount();
    const second = renderHook(() => usePersistentState("k", 5, isNumber));
    expect(second.result.current[0]).toBe(9);
  });

  it("persistent state survives throwing localStorage", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("no");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("no");
    });
    const { result } = renderHook(() => usePersistentState("k", 5, isNumber));
    expect(result.current[0]).toBe(5);
    act(() => result.current[1](7));
    expect(result.current[0]).toBe(7);
  });
});

describe("usePracticeKeys", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("practice keys ignore repeat events", () => {
    const fn = vi.fn();
    renderHook(() => usePracticeKeys({ p: fn }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", repeat: true, bubbles: true }));
    expect(fn).not.toHaveBeenCalled();
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("practice keys call preventDefault when a binding fires", () => {
    const fn = vi.fn();
    renderHook(() => usePracticeKeys({ " ": fn }));
    const event = new KeyboardEvent("keydown", { key: " ", cancelable: true, bubbles: true });
    document.body.dispatchEvent(event);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(event.defaultPrevented).toBe(true);
  });

  it("practice keys ignore inherited properties as keys", () => {
    const fn = vi.fn();
    renderHook(() => usePracticeKeys({ p: fn }));
    const event = new KeyboardEvent("keydown", { key: "constructor", cancelable: true, bubbles: true });
    document.body.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(false);
    expect(fn).not.toHaveBeenCalled();
  });

  it("practice keys fire space and ignore inputs", () => {
    const fn = vi.fn();
    renderHook(() => usePracticeKeys({ " ": fn }));
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    const input = document.createElement("input");
    document.body.appendChild(input);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: " ", ctrlKey: true, bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    input.remove();
  });

  it("practice keys match letters case-insensitively and respect enabled", () => {
    const fn = vi.fn();
    const { rerender } = renderHook(({ e }) => usePracticeKeys({ p: fn }, e), { initialProps: { e: true } });
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "P", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
    rerender({ e: false });
    document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("practice keys ignore links and role=button elements", () => {
    const fn = vi.fn();
    renderHook(() => usePracticeKeys({ Enter: fn }));
    const link = document.createElement("a");
    link.href = "/x";
    const div = document.createElement("div");
    div.setAttribute("role", "button");
    document.body.append(link, div);
    link.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    div.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
    expect(fn).not.toHaveBeenCalled();
  });

  it("practice keys fire letters on buttons but leave space and Enter to them", () => {
    const p = vi.fn();
    const space = vi.fn();
    const enter = vi.fn();
    renderHook(() => usePracticeKeys({ p, " ": space, Enter: enter }));
    const button = document.createElement("button");
    const link = document.createElement("a");
    link.href = "/x";
    document.body.append(button, link);
    for (const el of [button, link]) {
      el.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      el.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    }
    expect(space).not.toHaveBeenCalled();
    expect(enter).not.toHaveBeenCalled();
    expect(p).toHaveBeenCalledTimes(2);
    button.remove();
    link.remove();
  });

  it("practice keys ignore every key in text fields", () => {
    const p = vi.fn();
    renderHook(() => usePracticeKeys({ p }));
    const fields = [document.createElement("input"), document.createElement("textarea"), document.createElement("select")];
    const editable = document.createElement("div");
    editable.setAttribute("contenteditable", "true");
    document.body.append(...fields, editable);
    for (const el of [...fields, editable]) el.dispatchEvent(new KeyboardEvent("keydown", { key: "p", bubbles: true }));
    expect(p).not.toHaveBeenCalled();
    for (const el of [...fields, editable]) el.remove();
  });
});
