import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ChordEditor } from "./ChordEditor.js";

const initial = {
  name: "Em",
  frets: [0, 2, 2, 0, 0, 0],
  fingers: [null, 2, 3, null, null, null],
  baseFret: 1,
};

describe("ChordEditor", () => {
  it("saves the untouched shape for the given scope", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "Nur in diesem Song" }));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ frets: initial.frets }), "song");
  });

  it("sets a dot when an empty cell is clicked", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("cell-5-3"));
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0]![0].frets[5]).toBe(3);
  });

  it("removes the dot when the same cell is clicked again", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("cell-1-2"));
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0]![0].frets[1]).toBe(0);
  });

  it("toggles a string between open and muted", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("head-0"));
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0]![0].frets[0]).toBeNull();
  });

  it("starts from an empty grid when nothing is stored yet", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Hglurb" initial={null} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0]![0].frets).toEqual([0, 0, 0, 0, 0, 0]);
    expect(onSave.mock.calls[0]![0].fingers).toEqual([null, null, null, null, null, null]);
  });

  it("hides the song button when the song scope is not available", () => {
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope={false} onSave={vi.fn()} onCancel={vi.fn()} />,
    );
    expect(screen.queryByRole("button", { name: "Nur in diesem Song" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "In allen Songs" })).toBeInTheDocument();
  });

  it("offers a reset only for a scope that has something stored", async () => {
    const onReset = vi.fn();
    render(
      <ChordEditor
        symbol="Em"
        initial={initial}
        allowSongScope
        canReset={{ song: true, global: false }}
        onSave={vi.fn()}
        onReset={onReset}
        onCancel={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Globalen Griff zurücksetzen" })).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Griff für diesen Song zurücksetzen" }));
    expect(onReset).toHaveBeenCalledWith("song");
  });
});
