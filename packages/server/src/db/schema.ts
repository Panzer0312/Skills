import { index, integer, primaryKey, real, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const skills = sqliteTable("skills", {
  id: text("id").primaryKey(),
  installedAt: integer("installed_at").notNull(),
  settingsJson: text("settings_json").notNull().default("{}"),
});

export const modules = sqliteTable(
  "modules",
  {
    id: text("id").notNull(),
    skillId: text("skill_id").notNull(),
    type: text("type").notNull(),
    title: text("title").notNull(),
    metaJson: text("meta_json").notNull().default("{}"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.id] }) }),
);

export const noteTypes = sqliteTable("note_types", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  fieldsJson: text("fields_json").notNull(),
  templatesJson: text("templates_json").notNull(),
});

export const notes = sqliteTable("notes", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  skillId: text("skill_id").notNull(),
  noteTypeId: integer("note_type_id"),
  fieldsJson: text("fields_json").notNull(),
  sourceApkg: text("source_apkg"),
});

export const cards = sqliteTable(
  "cards",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    skillId: text("skill_id").notNull(),
    moduleId: text("module_id").notNull(),
    cardKey: text("card_key").notNull(),
    noteId: integer("note_id"),
    frontJson: text("front_json").notNull(),
    backJson: text("back_json").notNull(),
    tags: text("tags").notNull().default("[]"),
    state: text("state").notNull().default("active"),
  },
  (t) => ({
    identity: uniqueIndex("cards_identity").on(t.skillId, t.moduleId, t.cardKey),
    byModule: index("cards_by_module").on(t.skillId, t.moduleId),
  }),
);

export const scheduling = sqliteTable(
  "scheduling",
  {
    cardId: integer("card_id").primaryKey(),
    state: text("state").notNull(),
    due: integer("due").notNull(),
    stability: real("stability").notNull(),
    difficulty: real("difficulty").notNull(),
    reps: integer("reps").notNull(),
    lapses: integer("lapses").notNull(),
    lastReview: integer("last_review"),
    suspended: integer("suspended").notNull().default(0),
    buriedUntil: integer("buried_until"),
  },
  (t) => ({ byDue: index("scheduling_by_due").on(t.due) }),
);

export const reviews = sqliteTable(
  "reviews",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    cardId: integer("card_id").notNull(),
    reviewedAt: integer("reviewed_at").notNull(),
    rating: integer("rating").notNull(),
    elapsedMs: integer("elapsed_ms").notNull().default(0),
    stateBefore: text("state_before").notNull(),
    stateAfter: text("state_after").notNull(),
  },
  (t) => ({ byTime: index("reviews_by_time").on(t.reviewedAt) }),
);

export const lessonProgress = sqliteTable(
  "lesson_progress",
  {
    skillId: text("skill_id").notNull(),
    lessonId: text("lesson_id").notNull(),
    status: text("status").notNull(),
    completedAt: integer("completed_at"),
    checkpointJson: text("checkpoint_json").notNull().default("{}"),
  },
  (t) => ({ pk: primaryKey({ columns: [t.skillId, t.lessonId] }) }),
);

export const songs = sqliteTable("songs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  title: text("title").notNull(),
  artist: text("artist"),
  sourceUrl: text("source_url"),
  format: text("format").notNull(),
  content: text("content").notNull(),
  addedAt: integer("added_at").notNull(),
  difficulty: integer("difficulty"),
  tags: text("tags").notNull().default("[]"),
});

export const media = sqliteTable(
  "media",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    filename: text("filename").notNull(),
    mime: text("mime").notNull(),
    sha256: text("sha256").notNull(),
    path: text("path").notNull(),
  },
  (t) => ({ bySha: uniqueIndex("media_by_sha").on(t.sha256) }),
);

export const settings = sqliteTable("settings", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

export const chordOverrides = sqliteTable(
  "chord_overrides",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    scope: text("scope").notNull(),
    songKey: text("song_key").notNull().default(""),
    symbol: text("symbol").notNull(),
    name: text("name"),
    fretsJson: text("frets_json").notNull(),
    fingersJson: text("fingers_json").notNull(),
    baseFret: integer("base_fret").notNull(),
    updatedAt: integer("updated_at").notNull(),
  },
  (t) => ({
    identity: uniqueIndex("chord_overrides_identity").on(t.scope, t.songKey, t.symbol),
  }),
);
