import { QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { queryClient } from "../../../packages/web/src/app/queryClient.js";
import { UndoButton } from "./UndoButton.js";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function renderButton(onUndone?: () => void) {
  return render(
    <QueryClientProvider client={queryClient}>
      <UndoButton logId={7} onUndone={onUndone} />
    </QueryClientProvider>,
  );
}

function deletes(fetchMock: ReturnType<typeof vi.fn>) {
  return fetchMock.mock.calls.filter(([, init]) => (init as RequestInit | undefined)?.method === "DELETE");
}

afterEach(() => vi.unstubAllGlobals());

describe("UndoButton", () => {
  it("undo deletes the logged entry", async () => {
    const fetchMock = vi.fn(async () => json({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    const onUndone = vi.fn();
    renderButton(onUndone);
    fireEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect(await screen.findByText("Eintrag entfernt.")).toBeTruthy();
    const calls = deletes(fetchMock);
    expect(calls).toHaveLength(1);
    expect(String(calls[0]![0])).toBe("/api/game/guitar/log/7");
    expect(onUndone).toHaveBeenCalledTimes(1);
  });

  it("undo failure shows alert", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => json({ error: "x" }, 500)));
    const onUndone = vi.fn();
    renderButton(onUndone);
    fireEvent.click(screen.getByRole("button", { name: "Rückgängig" }));
    expect((await screen.findByRole("alert")).textContent).toBe("Das konnte nicht rückgängig gemacht werden.");
    expect(onUndone).not.toHaveBeenCalled();
    expect((screen.getByRole("button", { name: "Rückgängig" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("undo cannot be sent twice", async () => {
    let release: (r: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (release = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    renderButton();
    const button = screen.getByRole("button", { name: "Rückgängig" }) as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(button.disabled).toBe(true);
    expect(deletes(fetchMock)).toHaveLength(1);
    release(json({ ok: true }));
    await waitFor(() => expect(screen.getByText("Eintrag entfernt.")).toBeTruthy());
    expect(deletes(fetchMock)).toHaveLength(1);
  });
});
