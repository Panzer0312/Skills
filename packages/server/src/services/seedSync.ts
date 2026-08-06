import { newSchedulingState } from "@skills/core";
import type { AppDatabase } from "../db/client.js";

export interface SeedCard {
  moduleId: string;
  cardKey: string;
  front: string;
  back: string;
  reading?: string;
  note?: string;
  example?: string;
  tags: string[];
}

export interface SeedRequest {
  skillId: string;
  name: string;
  modules: { id: string; type: string; title: string }[];
  cards: SeedCard[];
}

export interface SeedResult {
  created: number;
  updated: number;
  archived: number;
  unchanged: number;
}

interface ExistingRow {
  id: number;
  module_id: string;
  card_key: string;
  front_json: string;
  back_json: string;
  tags: string;
  state: string;
}

function frontOf(card: SeedCard): string {
  return JSON.stringify({ text: card.front });
}

function backOf(card: SeedCard): string {
  return JSON.stringify({
    text: card.back,
    reading: card.reading ?? null,
    note: card.note ?? null,
    example: card.example ?? null,
  });
}

export function syncSkill(database: AppDatabase, request: SeedRequest, now: number): SeedResult {
  const { raw } = database;
  const result: SeedResult = { created: 0, updated: 0, archived: 0, unchanged: 0 };

  const run = raw.transaction(() => {
    raw
      .prepare("INSERT INTO skills (id, installed_at) VALUES (?, ?) ON CONFLICT(id) DO NOTHING")
      .run(request.skillId, now);

    const upsertModule = raw.prepare(
      `INSERT INTO modules (id, skill_id, type, title) VALUES (?, ?, ?, ?)
       ON CONFLICT(skill_id, id) DO UPDATE SET type = excluded.type, title = excluded.title`,
    );
    for (const mod of request.modules) {
      upsertModule.run(mod.id, request.skillId, mod.type, mod.title);
    }

    const existing = raw
      .prepare(
        "SELECT id, module_id, card_key, front_json, back_json, tags, state FROM cards WHERE skill_id = ?",
      )
      .all(request.skillId) as ExistingRow[];
    const byIdentity = new Map(existing.map((row) => [`${row.module_id} ${row.card_key}`, row]));

    const insertCard = raw.prepare(
      `INSERT INTO cards (skill_id, module_id, card_key, front_json, back_json, tags, state)
       VALUES (?, ?, ?, ?, ?, ?, 'active')`,
    );
    const insertScheduling = raw.prepare(
      `INSERT INTO scheduling (card_id, state, due, stability, difficulty, reps, lapses, last_review)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    const updateCard = raw.prepare(
      "UPDATE cards SET front_json = ?, back_json = ?, tags = ?, state = 'active' WHERE id = ?",
    );
    const archiveCard = raw.prepare("UPDATE cards SET state = 'archived' WHERE id = ?");

    const seen = new Set<string>();
    for (const card of request.cards) {
      const identity = `${card.moduleId} ${card.cardKey}`;
      seen.add(identity);
      const front = frontOf(card);
      const back = backOf(card);
      const tags = JSON.stringify(card.tags);
      const row = byIdentity.get(identity);

      if (!row) {
        const info = insertCard.run(request.skillId, card.moduleId, card.cardKey, front, back, tags);
        const fresh = newSchedulingState(now);
        insertScheduling.run(
          Number(info.lastInsertRowid),
          fresh.state,
          fresh.due,
          fresh.stability,
          fresh.difficulty,
          fresh.reps,
          fresh.lapses,
          fresh.lastReview,
        );
        result.created += 1;
        continue;
      }

      const identical =
        row.front_json === front &&
        row.back_json === back &&
        row.tags === tags &&
        row.state === "active";
      if (identical) {
        result.unchanged += 1;
      } else {
        updateCard.run(front, back, tags, row.id);
        result.updated += 1;
      }
    }

    for (const row of existing) {
      const identity = `${row.module_id} ${row.card_key}`;
      if (!seen.has(identity) && row.state !== "archived") {
        archiveCard.run(row.id);
        result.archived += 1;
      }
    }
  });

  run();
  return result;
}
