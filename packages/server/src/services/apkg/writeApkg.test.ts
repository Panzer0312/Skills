import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../../db/client.js";
import { syncSkill } from "../seedSync.js";
import { readApkg } from "./read.js";
import { writeApkg } from "./writeApkg.js";

describe("writeApkg", () => {
  let database: AppDatabase;

  beforeEach(() => {
    database = openDatabase(":memory:");
    syncSkill(
      database,
      {
        skillId: "japanese",
        name: "Japanisch",
        modules: [{ id: "vokabeln", type: "srs-deck", title: "Vokabeln" }],
        cards: [
          { moduleId: "vokabeln", cardKey: "にほん", front: "日本", back: "Japan", reading: "にほん", tags: ["land"] },
          { moduleId: "vokabeln", cardKey: "いぬ", front: "犬", back: "Hund", reading: "いぬ", tags: [] },
        ],
      },
      Date.now(),
    );
  });

  it("produces an archive that the reader can parse back", () => {
    const bytes = writeApkg(database, "japanese", "vokabeln", "Vokabeln");
    const parsed = readApkg(bytes);
    expect(parsed.deckName).toBe("Vokabeln");
    expect(parsed.notes).toHaveLength(2);
    expect(parsed.noteTypes[0]?.fields).toEqual(["Vorderseite", "Rückseite", "Lesung", "Notiz"]);
  });

  it("round-trips content and tags", () => {
    const parsed = readApkg(writeApkg(database, "japanese", "vokabeln", "Vokabeln"));
    const nihon = parsed.notes.find((note) => note.fields[0] === "日本");
    expect(nihon?.fields[1]).toBe("Japan");
    expect(nihon?.fields[2]).toBe("にほん");
    expect(nihon?.tags).toEqual(["land"]);
  });

  it("skips archived cards", () => {
    database.raw.prepare("UPDATE cards SET state = 'archived' WHERE card_key = 'いぬ'").run();
    const parsed = readApkg(writeApkg(database, "japanese", "vokabeln", "Vokabeln"));
    expect(parsed.notes).toHaveLength(1);
  });

  it("throws when the module holds no cards", () => {
    expect(() => writeApkg(database, "japanese", "gibtsnicht", "Leer")).toThrowError(/keine Karten/i);
  });
});
