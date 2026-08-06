import { beforeEach, describe, expect, it } from "vitest";
import { openDatabase, type AppDatabase } from "../db/client.js";
import { syncSkill, type SeedRequest } from "./seedSync.js";

const NOW = Date.UTC(2026, 0, 5);

function request(cards: { key: string; back: string }[]): SeedRequest {
  return {
    skillId: "demo",
    name: "Demo",
    modules: [{ id: "cards", type: "srs-deck", title: "Karten" }],
    cards: cards.map((c) => ({
      moduleId: "cards",
      cardKey: c.key,
      front: c.key,
      back: c.back,
      tags: [],
    })),
  };
}

describe("syncSkill", () => {
  let database: AppDatabase;
  beforeEach(() => {
    database = openDatabase(":memory:");
  });

  it("creates cards with fresh scheduling on first sync", () => {
    const result = syncSkill(database, request([{ key: "a", back: "A" }]), NOW);
    expect(result).toEqual({ created: 1, updated: 0, archived: 0, unchanged: 0 });
    const rows = database.raw
      .prepare("SELECT state, due FROM scheduling")
      .all() as { state: string; due: number }[];
    expect(rows).toHaveLength(1);
    expect(rows[0]?.state).toBe("new");
    expect(rows[0]?.due).toBe(NOW);
  });

  it("keeps scheduling when card content changes", () => {
    syncSkill(database, request([{ key: "a", back: "A" }]), NOW);
    database.raw.prepare("UPDATE scheduling SET state = 'review', reps = 7").run();
    const result = syncSkill(database, request([{ key: "a", back: "Anders" }]), NOW + 1000);
    expect(result.updated).toBe(1);
    const row = database.raw
      .prepare("SELECT state, reps FROM scheduling")
      .get() as { state: string; reps: number };
    expect(row.state).toBe("review");
    expect(row.reps).toBe(7);
  });

  it("archives cards that disappear and restores them on return", () => {
    syncSkill(database, request([{ key: "a", back: "A" }, { key: "b", back: "B" }]), NOW);
    database.raw.prepare("UPDATE scheduling SET reps = 3").run();

    const removed = syncSkill(database, request([{ key: "a", back: "A" }]), NOW);
    expect(removed.archived).toBe(1);
    const archived = database.raw
      .prepare("SELECT state FROM cards WHERE card_key = 'b'")
      .get() as { state: string };
    expect(archived.state).toBe("archived");

    const restored = syncSkill(
      database,
      request([{ key: "a", back: "A" }, { key: "b", back: "B" }]),
      NOW,
    );
    expect(restored.created).toBe(0);
    const back = database.raw
      .prepare(
        "SELECT c.state, s.reps FROM cards c JOIN scheduling s ON s.card_id = c.id WHERE c.card_key = 'b'",
      )
      .get() as { state: string; reps: number };
    expect(back.state).toBe("active");
    expect(back.reps).toBe(3);
  });

  it("reports unchanged cards on a repeated identical sync", () => {
    syncSkill(database, request([{ key: "a", back: "A" }]), NOW);
    const second = syncSkill(database, request([{ key: "a", back: "A" }]), NOW);
    expect(second).toEqual({ created: 0, updated: 0, archived: 0, unchanged: 1 });
  });
});
