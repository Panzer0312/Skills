import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import ReadingTrainer from "./ReadingTrainer.js";

const kanji = [
  {
    kanji: "日",
    bedeutung: "Tag, Sonne",
    on: ["にち"],
    kun: ["ひ"],
    strokes: 4,
    radikal: "日",
    merksatz: "Ein Fenster, durch das die Sonne scheint, jeden Tag aufs Neue.",
    beispiele: [{ wort: "日本", lesung: "にほん", bedeutung: "Japan", lesungsart: "on" }],
  },
];

const saetze = [
  {
    id: "s-001",
    stufe: "satz",
    japanisch: "日本語",
    uebersetzung: "Japanisch",
    tokens: [
      {
        text: "日本語",
        lesung: "にほんご",
        bedeutung: "Japanisch",
        begruendung: "Drei Kanji in Folge: on-Lesung.",
      },
    ],
  },
];

const regeln = [{ Regel: "Rendaku", Erklaerung: "Wird weich.", Merksatz: "Zweiter Teil weich.", Beispiel: "てがみ" }];

function makeProgress() {
  return { record: vi.fn(), get: () => null, complete: vi.fn(async () => {}) };
}

// `ModuleRoute` hands widgets a flat list of entries — every array-shaped data
// file gets spread into its individual items (see ModuleRoute.collect) — so the
// widget is exercised the same way here instead of with whole-file arrays.
const flatData = [...kanji, ...saetze, ...regeln];

describe("ReadingTrainer", () => {
  it("hides the reading until the token is clicked", async () => {
    render(<ReadingTrainer data={flatData} progress={makeProgress()} settings={{}} />);
    await userEvent.click(screen.getByRole("tab", { name: /Lesetraining/ }));

    expect(screen.queryByText("にほんご")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "日本語" }));
    expect(screen.getByText("にほんご")).toBeInTheDocument();
    expect(screen.getByText(/on-Lesung/)).toBeInTheDocument();
  });

  it("reveals translation and furigana on demand and records the self assessment", async () => {
    const progress = makeProgress();
    render(<ReadingTrainer data={flatData} progress={progress} settings={{}} />);
    await userEvent.click(screen.getByRole("tab", { name: /Lesetraining/ }));

    await userEvent.click(screen.getByRole("button", { name: /Aufdecken/ }));
    expect(screen.getByText("Japanisch")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /Konnte ich/ }));
    expect(progress.record).toHaveBeenCalledWith("s-001", "correct");
  });

  it("lists kanji with both reading types", async () => {
    render(<ReadingTrainer data={flatData} progress={makeProgress()} settings={{}} />);
    expect(screen.getByText("日")).toBeInTheDocument();
    expect(screen.getByText(/にち/)).toBeInTheDocument();
    expect(screen.getByText(/ひ/)).toBeInTheDocument();
  });

  it("shows the reading rules in their own tab", async () => {
    render(<ReadingTrainer data={flatData} progress={makeProgress()} settings={{}} />);
    await userEvent.click(screen.getByRole("tab", { name: /Regeln/ }));
    expect(screen.getByText("Rendaku")).toBeInTheDocument();
  });
});
