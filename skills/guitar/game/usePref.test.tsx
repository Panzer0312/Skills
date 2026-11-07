import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { usePref } from "./usePref.js";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
);

beforeEach(() => queryClient.clear());
afterEach(() => vi.unstubAllGlobals());

describe("usePref", () => {
  it("usePref returns default while loading and updates optimistically", async () => {
    let release!: () => void;
    const gate = new Promise<void>((r) => (release = r));
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      if (init?.method === "PUT") {
        await gate;
        return json({ ok: true });
      }
      return json({ prefs: { "intro.gesehen": false } });
    });
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    expect(result.current[0]).toBe(false);
    expect(result.current[2].loading).toBe(true);
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    await waitFor(() => expect(result.current[0]).toBe(true));
    release();
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "PUT")).toBe(true));
    const put = fetchMock.mock.calls.find(([, i]) => (i as RequestInit | undefined)?.method === "PUT")!;
    expect(String(put[0])).toBe("/api/game/guitar/prefs");
    expect(JSON.parse((put[1] as RequestInit).body as string)).toEqual({ key: "intro.gesehen", value: true });
  });

  it("usePref rolls back on failure", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "PUT"
        ? json({ error: { code: "invalid_pref", message: "x" } }, 400)
        : json({ prefs: { "intro.gesehen": false } }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    await waitFor(() => expect(fetchMock.mock.calls.some(([, i]) => (i as RequestInit | undefined)?.method === "PUT")).toBe(true));
    await waitFor(() => expect(result.current[0]).toBe(false));
  });
});
