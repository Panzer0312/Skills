import { describe, expect, it } from "vitest";
import { ambienceAllowed } from "./sound/ambience.js";
import { GAME_BASE } from "./api.js";
import { ambiencePaths, PLACES } from "./placeRegistry.js";
import { QUEST_TOOLS } from "./questTools.js";
import { gameContent } from "./api.js";

describe("places registry", () => {
  it("covers every current menu entry in order", () => {
    expect(PLACES.filter((p) => p.inMenu).map((p) => [p.path, p.label, p.hint, p.sprite])).toEqual([
      ["schrein", "Shrine", "Stimmgerät", "ring"],
      ["schmiede", "Forge", "Akkordgriffe", "sword"],
      ["griffbrett", "Tower of CAGED", "Griffbrett", "bow"],
      ["riffs", "Riffs", "Tabs zum Üben", "shield"],
      ["jam", "Jam Room", "Begleitung", "potion"],
      ["chronik", "Chronicle", "dein Fortschritt", "parchment"],
    ]);
  });

  it("covers every other route and only gates the quest board", () => {
    expect(PLACES.map((p) => p.path).sort()).toEqual(
      [
        "bibliothek",
        "chronik",
        "griffbrett",
        "hafen",
        "jam",
        "markt",
        "quests",
        "riffs",
        "schmiede",
        "schrein",
        "taverne",
      ].sort(),
    );
    expect(PLACES.filter((p) => p.gated).map((p) => p.path)).toEqual(["quests"]);
  });

  it("allows ambience on exactly the same paths as before", () => {
    const { paths, withSubpath } = ambiencePaths();
    expect([...paths].sort()).toEqual(["", "bibliothek", "chronik", "hafen", "markt"]);
    expect([...withSubpath].sort()).toEqual(["bibliothek", "hafen"]);
    const probes = [
      "",
      "/quests",
      "/quest/x",
      "/markt",
      "/markt/x",
      "/bibliothek/a",
      "/hafen/n",
      "/chronik",
      "/chronik/x",
      "/jam",
      "/schrein",
    ];
    for (const probe of probes) {
      const [first = "", ...rest] = probe.split("/").filter(Boolean);
      const viaRegistry = paths.has(first) && (rest.length === 0 || withSubpath.has(first));
      expect(viaRegistry, probe).toBe(ambienceAllowed(`${GAME_BASE}${probe}`));
    }
  });
});

describe("quest tools", () => {
  const find = (pred: (q: (typeof gameContent.quests)[number]) => boolean) => gameContent.quests.find(pred)!;
  const ids = (q: (typeof gameContent.quests)[number]) => QUEST_TOOLS.filter((t) => t.applies(q)).map((t) => t.id);

  it("render the same tools as before for a wechsel, note, riff and fretboard quest", () => {
    expect(ids(find((q) => q.kind === "wechsel"))).toContain("chordTrainer");
    expect(ids(find((q) => Boolean(q.noteGame)))).toContain("noteFinder");
    expect(ids(find((q) => gameContent.riffs.some((r) => r.id === q.riffId)))).toContain("riff");
    expect(ids(find((q) => Boolean(q.fretboard)))).toContain("fretOverlay");
    expect(ids(find((q) => Boolean(q.chords)))).toContain("griffbild");
    expect(QUEST_TOOLS.map((t) => t.id)).toEqual(["griffbild", "riff", "fretOverlay", "chordTrainer", "noteFinder"]);
  });
});
