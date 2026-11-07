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
  const request = vi.fn(() => Promise.resolve({ release }));
  Object.defineProperty(navigator, "wakeLock", { value: { request }, configurable: true });
  return { request, release };
}

describe("useWakeLock", () => {
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
    link.remove();
    div.remove();
  });
});
