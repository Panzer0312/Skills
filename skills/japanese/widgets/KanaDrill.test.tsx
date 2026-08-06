import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import KanaDrill from "./KanaDrill.js";

const file = {
  script: "hiragana",
  entries: [
    {
      kana: "あ",
      romaji: "a",
      strokes: 3,
      merksatz: "あ hat ein A im Bauch, gut sichtbar.",
      beispiel: { wort: "あめ", lesung: "ame", bedeutung: "Regen" },
      verwechslung: [],
    },
    {
      kana: "い",
      romaji: "i",
      strokes: 2,
      merksatz: "Zwei Striche wie zwei i-Punkte nebeneinander.",
      beispiel: { wort: "いぬ", lesung: "inu", bedeutung: "Hund" },
      verwechslung: [],
    },
  ],
};

function makeProgress() {
  const store = new Map<string, "correct" | "wrong">();
  return {
    record: vi.fn((id: string, result: "correct" | "wrong") => store.set(id, result)),
    get: (id: string) => store.get(id) ?? null,
    complete: vi.fn(async () => {}),
  };
}

describe("KanaDrill", () => {
  it("asks for the reading and accepts the right answer", async () => {
    const progress = makeProgress();
    render(<KanaDrill data={[file]} progress={progress} settings={{}} />);

    const prompt = screen.getByTestId("prompt").textContent!;
    const expected = prompt === "あ" ? "a" : "i";

    await userEvent.type(screen.getByRole("textbox"), expected);
    await userEvent.click(screen.getByRole("button", { name: /prüfen/i }));

    expect(screen.getByText(/richtig/i)).toBeInTheDocument();
    expect(progress.record).toHaveBeenCalledWith(prompt, "correct");
  });

  it("shows the mnemonic after a wrong answer", async () => {
    const progress = makeProgress();
    render(<KanaDrill data={[file]} progress={progress} settings={{}} />);

    await userEvent.type(screen.getByRole("textbox"), "zzz");
    await userEvent.click(screen.getByRole("button", { name: /prüfen/i }));

    expect(screen.getByText(/Merksatz/)).toBeInTheDocument();
    expect(progress.record).toHaveBeenCalledWith(expect.any(String), "wrong");
  });

  it("can switch to the reverse direction", async () => {
    const progress = makeProgress();
    render(<KanaDrill data={[file]} progress={progress} settings={{}} />);

    await userEvent.click(screen.getByRole("button", { name: /Laut → Zeichen/ }));
    const prompt = screen.getByTestId("prompt").textContent!;
    expect(["a", "i"]).toContain(prompt);
  });
});
