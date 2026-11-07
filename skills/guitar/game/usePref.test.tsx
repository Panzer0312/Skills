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

/** A small stateful server: GET returns the stored values, PUT waits for its gate and then stores or fails. */
function server(gates: Record<string, { release: () => void; fail?: boolean }> = {}) {
  const stored: Record<string, unknown> = { "intro.gesehen": false };
  const puts: string[] = [];
  const waits: Record<string, Promise<void>> = {};
  for (const [k, g] of Object.entries(gates)) waits[k] = new Promise<void>((r) => (g.release = r));
  const mock = vi.fn(async (_url: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      const body = JSON.parse(init.body as string) as { key: string; value: unknown };
      puts.push(body.key);
      await waits[body.key];
      if (gates[body.key]?.fail) return json({ error: { code: "invalid_pref", message: "x" } }, 400);
      stored[body.key] = body.value;
      return json({ ok: true });
    }
    return json({ prefs: { ...stored } });
  });
  vi.stubGlobal("fetch", mock);
  return { mock, stored, puts };
}

beforeEach(() => queryClient.clear());
afterEach(() => vi.unstubAllGlobals());

describe("usePref", () => {
  it("usePref returns default while loading and updates optimistically", async () => {
    const gates = { "intro.gesehen": { release: () => {} } };
    const { mock, puts } = server(gates);
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    expect(result.current[0]).toBe(false);
    expect(result.current[2].loading).toBe(true);
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    await waitFor(() => expect(result.current[0]).toBe(true));
    await waitFor(() => expect(puts).toEqual(["intro.gesehen"]));
    const put = mock.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(String(put[0])).toBe("/api/game/guitar/prefs");
    act(() => gates["intro.gesehen"].release());
    // After the PUT resolves and the settle refetch, the value stays true.
    await waitFor(() => expect(mock.mock.calls.filter(([, i]) => !i?.method).length).toBeGreaterThanOrEqual(2));
    expect(result.current[0]).toBe(true);
  });

  it("usePref rolls back on failure", async () => {
    const gates = { "intro.gesehen": { release: () => {}, fail: true } };
    const { puts } = server(gates);
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    await waitFor(() => expect(result.current[0]).toBe(true));
    await waitFor(() => expect(puts).toHaveLength(1));
    expect(result.current[0]).toBe(true);
    act(() => gates["intro.gesehen"].release());
    await waitFor(() => expect(result.current[0]).toBe(false));
  });

  it("usePref keeps a concurrent write when an earlier one fails", async () => {
    // Two keys are needed; the registry has one, so the second write goes through the same hook API with a cast.
    const gates = { "intro.gesehen": { release: () => {}, fail: true }, "zweite.pref": { release: () => {} } };
    const { stored, puts } = server(gates);
    const a = renderHook(() => usePref("intro.gesehen"), { wrapper });
    const b = renderHook(() => usePref("zweite.pref" as "intro.gesehen"), { wrapper });
    await waitFor(() => expect(a.result.current[2].loading && b.result.current[2].loading).toBe(false));
    act(() => a.result.current[1](true));
    act(() => b.result.current[1](true));
    await waitFor(() => expect(puts).toHaveLength(2));
    act(() => gates["intro.gesehen"].release());
    await waitFor(() => expect(a.result.current[0]).toBe(false));
    expect(queryClient.getQueryData<{ prefs: Record<string, unknown> }>(["prefs", "guitar"])?.prefs["zweite.pref"]).toBe(true);
    act(() => gates["zweite.pref"].release());
    await waitFor(() => expect(stored["zweite.pref"]).toBe(true));
  });

  it("usePref coalesces quick sets into one PUT with the last value", async () => {
    const { mock, puts } = server();
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => {
      for (let i = 0; i < 20; i++) result.current[1](i % 2 === 1);
    });
    act(() => result.current[1](true));
    await waitFor(() => expect(result.current[0]).toBe(true));
    expect(puts).toHaveLength(0);
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 1500 });
    await new Promise((r) => setTimeout(r, 400));
    expect(puts).toHaveLength(1);
    const put = mock.mock.calls.find(([, i]) => i?.method === "PUT")!;
    expect(JSON.parse(put[1]!.body as string)).toEqual({ key: "intro.gesehen", value: true });
  });

  it("usePref flushes a pending write on unmount", async () => {
    const { puts } = server();
    const { result, unmount } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    expect(puts).toHaveLength(0);
    unmount();
    await waitFor(() => expect(puts).toEqual(["intro.gesehen"]));
  });

  it("usePref rolls back to the value before the burst when the flushed write fails", async () => {
    const gates = { "intro.gesehen": { release: () => {}, fail: true } };
    const { puts } = server(gates);
    const { result } = renderHook(() => usePref("intro.gesehen"), { wrapper });
    await waitFor(() => expect(result.current[2].loading).toBe(false));
    act(() => result.current[1](true));
    act(() => result.current[1](false));
    act(() => result.current[1](true));
    await waitFor(() => expect(puts).toHaveLength(1), { timeout: 1500 });
    expect(result.current[0]).toBe(true);
    act(() => gates["intro.gesehen"].release());
    await waitFor(() => expect(result.current[0]).toBe(false));
  });
});
