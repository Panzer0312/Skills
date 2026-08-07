# Akkord-Editor und Japanisch-Kurs — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Akkordgriffe lassen sich aus einem Song heraus bearbeiten — wahlweise nur für diesen Song oder für alle Songs — und der Skill „Japanisch" bekommt einen Anfängerkurs aus 30 aufeinander aufbauenden Lektionen.

**Architecture:** Griffbild-Overrides liegen in einer neuen SQLite-Tabelle `chord_overrides` hinter der Route `/api/chords` und schieben sich in `resolveChordShape` vor die bestehende Reihenfolge (Skill-JSON → `OPEN_CHORDS` → abgeleitetes Barré). Der Editor ist eine reine Formularkomponente ohne API-Wissen, die von zwei Stellen aus geöffnet wird: inline aus der Song-Ansicht und zentral aus dem Modul „Akkordgriffe". Der Japanisch-Kurs ist ein reines Inhalts-Vorhaben: 30 MDX-Dateien plus ein Modul-Eintrag, ohne Kernänderung.

**Tech Stack:** TypeScript, React 18, React Router, TanStack Query, Tailwind, Hono, better-sqlite3 + Drizzle, Zod, Vitest + Testing Library, Playwright, MDX.

**Spec:** `docs/superpowers/specs/2026-08-07-akkord-editor-und-japanisch-kurs-design.md`

## Global Constraints

- Alle nutzersichtbaren Texte sind deutsch. Code, Kommentare, Testnamen und Commit-Nachrichten sind englisch.
- Fehlerantworten des Servers haben immer die Form `{ error: { code, message } }` mit deutscher `message`.
- Neue Tabellen entstehen per Roh-DDL in `packages/server/src/db/client.ts` und werden in `packages/server/src/db/schema.ts` gespiegelt. Keine drizzle-kit-Migrationen (Entscheidungsprotokoll 2026-08-06).
- Kein Schreiben in `skills/*/chords/*.json` durch den Server. Die Oberfläche schreibt ausschließlich in die Datenbank.
- Griffbild-Daten haben überall dieselbe Form: `frets` und `fingers` sind Arrays der Länge 6 (Index 0 = tiefe E-Saite), `frets[i]` ist `null` (gedämpft) oder 0–24, `fingers[i]` ist `null` oder 1–4, `baseFret` ist 1–24. Validierung immer über `chordFileEntrySchema` aus `@skills/core`, nie über ein zweites Schema.
- Song-Schlüssel: mitgelieferte Übungsstücke `uebung:<id>`, importierte Songs `song:<id>`.
- Tests laufen mit `npm test` (Vitest, gesamtes Workspace) und `npm run typecheck`. E2E mit `npm run test:e2e`.
- Nach jeder Aufgabe committen. Commit-Betreff englisch, Conventional Commits.

---

## Dateiübersicht

**Teil A — Akkord-Editor**

| Datei | Verantwortung |
| --- | --- |
| `packages/server/src/db/client.ts` (ändern) | DDL für `chord_overrides` |
| `packages/server/src/db/schema.ts` (ändern) | Drizzle-Spiegel der Tabelle |
| `packages/server/src/routes/chords.ts` (neu) | GET/PUT/DELETE `/api/chords` |
| `packages/server/src/routes/chords.test.ts` (neu) | Routentests |
| `packages/server/src/app.ts` (ändern) | Route registrieren |
| `packages/web/src/api/client.ts` (ändern) | `del<T>()` ergänzen |
| `packages/web/src/music/chordOverrides.ts` (neu) | Typen `ChordOverrideEntry`, `ChordOverrides`; `toShapeMap()` |
| `packages/web/src/music/chordOverrides.test.ts` (neu) | Tests dazu |
| `packages/web/src/music/userChords.ts` (ändern) | `resolveChordShape(symbol, overrides?)` |
| `packages/web/src/music/useChordOverrides.ts` (neu) | React-Query-Hook: laden, speichern, zurücksetzen |
| `packages/web/src/music/ChordEditor.tsx` (neu) | reine Formularkomponente |
| `packages/web/src/music/ChordEditor.test.tsx` (neu) | Tests dazu |
| `packages/web/src/music/ChordDiagramSingle.tsx` (ändern) | `overrides`- und `onEdit`-Prop |
| `packages/web/src/features/songs/SongView.tsx` (ändern) | `songKey`-Prop, Editor-Dialog |
| `skills/guitar/widgets/SongLibrary.tsx` (ändern) | `songKey` durchreichen |
| `skills/guitar/widgets/ChordDiagram.tsx` (ändern) | Reiter „Eigene Griffe" |
| `e2e/guitar.spec.ts` (ändern) | Ende-zu-Ende-Test des Editors |
| `docs/skills-authoring.md`, `README.md`, `PROJECT_LOG.md` (ändern) | Dokumentation |

**Teil B — Japanisch-Kurs**

| Datei | Verantwortung |
| --- | --- |
| `skills/japanese/lessons/01-…mdx` … `30-…mdx` (neu) | Kursinhalte |
| `skills/japanese/lessons/lessons.test.ts` (neu) | Strukturtests |
| `skills/japanese/skill.json` (ändern) | Modul `kurs` |

---

## Task 1: Tabelle und API für Griffbild-Overrides

**Files:**
- Modify: `packages/server/src/db/client.ts` (DDL-Konstante, nach dem `settings`-Block)
- Modify: `packages/server/src/db/schema.ts` (am Dateiende)
- Create: `packages/server/src/routes/chords.ts`
- Create: `packages/server/src/routes/chords.test.ts`
- Modify: `packages/server/src/app.ts`

**Interfaces:**
- Consumes: `chordFileEntrySchema` aus `@skills/core`, `AppEnv` aus `../app.js`, `openDatabase` aus `../db/client.js`.
- Produces: HTTP-Schnittstelle, auf die Task 2 und 5 zugreifen.
  - `GET /api/chords` → `{ global: ChordOverrideEntry[], song: ChordOverrideEntry[] }`
  - `GET /api/chords?songKey=song:3` → dasselbe, `song` gefüllt
  - `GET /api/chords?all=1` → `{ entries: ChordOverrideEntry[] }`
  - `PUT /api/chords` Body `{ scope, songKey?, symbol, name?, frets, fingers, baseFret }` → `{ entry: ChordOverrideEntry }`
  - `DELETE /api/chords?scope=…&symbol=…&songKey=…` → `{ ok: true }`
  - `ChordOverrideEntry = { id: number; scope: "global" | "song"; songKey: string; symbol: string; name: string | null; frets: (number|null)[]; fingers: (number|null)[]; baseFret: number; updatedAt: number }`

- [ ] **Step 1: Write the failing test**

Create `packages/server/src/routes/chords.test.ts`:

```ts
import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "../app.js";
import { openDatabase, type AppDatabase } from "../db/client.js";

const shape = {
  symbol: "F#m",
  name: "F#m (leichter)",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
};

describe("chord override routes", () => {
  let database: AppDatabase;
  let app: ReturnType<typeof createApp>;

  beforeEach(() => {
    database = openDatabase(":memory:");
    app = createApp(database);
  });

  async function put(body: unknown) {
    return app.request("/api/chords", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  }

  it("stores a global override and returns it", async () => {
    const res = await put({ scope: "global", ...shape });
    expect(res.status).toBe(200);

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toHaveLength(1);
    expect(list.global[0].symbol).toBe("F#m");
    expect(list.global[0].frets).toEqual(shape.frets);
    expect(list.global[0].songKey).toBe("");
    expect(list.song).toEqual([]);
  });

  it("keeps a song override separate from the global one", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "song", songKey: "song:3", ...shape, name: "nur hier" });

    const list = await (await app.request("/api/chords?songKey=song:3")).json();
    expect(list.global).toHaveLength(1);
    expect(list.song).toHaveLength(1);
    expect(list.song[0].name).toBe("nur hier");

    const other = await (await app.request("/api/chords?songKey=song:9")).json();
    expect(other.song).toEqual([]);
  });

  it("updates instead of duplicating on a second put", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "global", ...shape, baseFret: 5 });

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toHaveLength(1);
    expect(list.global[0].baseFret).toBe(5);
  });

  it("lists every entry with all=1", async () => {
    await put({ scope: "global", ...shape });
    await put({ scope: "song", songKey: "uebung:em-am-wiege", ...shape });

    const body = await (await app.request("/api/chords?all=1")).json();
    expect(body.entries).toHaveLength(2);
    expect(body.entries.map((e: { songKey: string }) => e.songKey).sort()).toEqual([
      "",
      "uebung:em-am-wiege",
    ]);
  });

  it("rejects an invalid shape", async () => {
    const res = await put({ scope: "global", ...shape, frets: [1, 2, 3] });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("invalid_body");
  });

  it("rejects a song scope without a song key", async () => {
    const res = await put({ scope: "song", ...shape });
    expect(res.status).toBe(400);
  });

  it("rejects a song key on a global scope", async () => {
    const res = await put({ scope: "global", songKey: "song:3", ...shape });
    expect(res.status).toBe(400);
  });

  it("deletes idempotently", async () => {
    await put({ scope: "global", ...shape });
    const first = await app.request("/api/chords?scope=global&symbol=F%23m", { method: "DELETE" });
    expect(first.status).toBe(200);
    const second = await app.request("/api/chords?scope=global&symbol=F%23m", { method: "DELETE" });
    expect(second.status).toBe(200);

    const list = await (await app.request("/api/chords")).json();
    expect(list.global).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- packages/server/src/routes/chords.test.ts`
Expected: FAIL — die Route existiert nicht, `app.request("/api/chords")` liefert 404.

- [ ] **Step 3: Add the table**

In `packages/server/src/db/client.ts`, an das Ende der `DDL`-Vorlage (nach dem `settings`-Block) anhängen:

```sql
CREATE TABLE IF NOT EXISTS chord_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  song_key TEXT NOT NULL DEFAULT '',
  symbol TEXT NOT NULL,
  name TEXT,
  frets_json TEXT NOT NULL,
  fingers_json TEXT NOT NULL,
  base_fret INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chord_overrides_identity
  ON chord_overrides (scope, song_key, symbol);
```

In `packages/server/src/db/schema.ts` am Dateiende:

```ts
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
```

- [ ] **Step 4: Write the route**

Create `packages/server/src/routes/chords.ts`:

```ts
import { chordFileEntrySchema } from "@skills/core";
import { Hono } from "hono";
import { z } from "zod";
import type { AppEnv } from "../app.js";

/**
 * A global override stores the empty string as its song key, not NULL: SQLite treats
 * NULLs in a unique index as distinct from each other, so NULL would leave global
 * entries effectively unconstrained.
 */
const GLOBAL_KEY = "";

const putSchema = chordFileEntrySchema
  .extend({
    scope: z.enum(["global", "song"]),
    songKey: z.string().optional(),
  })
  .refine((value) => (value.scope === "song" ? Boolean(value.songKey?.trim()) : true), {
    message: "Für einen songbezogenen Griff fehlt der Song.",
  })
  .refine((value) => (value.scope === "global" ? !value.songKey : true), {
    message: "Ein globaler Griff darf keinen Song tragen.",
  });

interface Row {
  id: number;
  scope: string;
  songKey: string;
  symbol: string;
  name: string | null;
  fretsJson: string;
  fingersJson: string;
  baseFret: number;
  updatedAt: number;
}

function toEntry(row: Row) {
  return {
    id: row.id,
    scope: row.scope as "global" | "song",
    songKey: row.songKey,
    symbol: row.symbol,
    name: row.name,
    frets: JSON.parse(row.fretsJson) as (number | null)[],
    fingers: JSON.parse(row.fingersJson) as (number | null)[],
    baseFret: row.baseFret,
    updatedAt: row.updatedAt,
  };
}

const SELECT = `SELECT id, scope, song_key AS songKey, symbol, name,
  frets_json AS fretsJson, fingers_json AS fingersJson,
  base_fret AS baseFret, updated_at AS updatedAt FROM chord_overrides`;

export const chordRoutes = new Hono<AppEnv>();

chordRoutes.get("/api/chords", (c) => {
  const { raw } = c.get("database");

  if (c.req.query("all") === "1") {
    const rows = raw.prepare(`${SELECT} ORDER BY symbol`).all() as Row[];
    return c.json({ entries: rows.map(toEntry) });
  }

  const songKey = c.req.query("songKey")?.trim();
  const global = raw
    .prepare(`${SELECT} WHERE scope = 'global' ORDER BY symbol`)
    .all() as Row[];
  const song = songKey
    ? (raw.prepare(`${SELECT} WHERE scope = 'song' AND song_key = ? ORDER BY symbol`).all(songKey) as Row[])
    : [];

  return c.json({ global: global.map(toEntry), song: song.map(toEntry) });
});

chordRoutes.put("/api/chords", async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = putSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      {
        error: {
          code: "invalid_body",
          message: parsed.error.issues[0]?.message ?? "Das Griffbild ist ungültig.",
        },
      },
      400,
    );
  }

  const { scope, songKey, symbol, name, frets, fingers, baseFret } = parsed.data;
  const key = scope === "song" ? songKey!.trim() : GLOBAL_KEY;
  const now = Date.now();

  c.get("database")
    .raw.prepare(
      `INSERT INTO chord_overrides (scope, song_key, symbol, name, frets_json, fingers_json, base_fret, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(scope, song_key, symbol) DO UPDATE SET
         name = excluded.name,
         frets_json = excluded.frets_json,
         fingers_json = excluded.fingers_json,
         base_fret = excluded.base_fret,
         updated_at = excluded.updated_at`,
    )
    .run(scope, key, symbol, name ?? null, JSON.stringify(frets), JSON.stringify(fingers), baseFret, now);

  const row = c
    .get("database")
    .raw.prepare(`${SELECT} WHERE scope = ? AND song_key = ? AND symbol = ?`)
    .get(scope, key, symbol) as Row;

  return c.json({ entry: toEntry(row) });
});

chordRoutes.delete("/api/chords", (c) => {
  const scope = c.req.query("scope");
  const symbol = c.req.query("symbol");
  if ((scope !== "global" && scope !== "song") || !symbol) {
    return c.json(
      { error: { code: "invalid_query", message: "Es fehlt der Geltungsbereich oder das Symbol." } },
      400,
    );
  }
  const key = scope === "song" ? (c.req.query("songKey") ?? "") : GLOBAL_KEY;

  c.get("database")
    .raw.prepare("DELETE FROM chord_overrides WHERE scope = ? AND song_key = ? AND symbol = ?")
    .run(scope, key, symbol);

  return c.json({ ok: true });
});
```

In `packages/server/src/app.ts` importieren und registrieren (nach `songRoutes`):

```ts
import { chordRoutes } from "./routes/chords.js";
// …
app.route("/", chordRoutes);
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test -- packages/server/src/routes/chords.test.ts`
Expected: PASS, 8 Tests.

- [ ] **Step 6: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: alles grün.

- [ ] **Step 7: Commit**

```bash
git add packages/server/src/db/client.ts packages/server/src/db/schema.ts \
        packages/server/src/routes/chords.ts packages/server/src/routes/chords.test.ts \
        packages/server/src/app.ts
git commit -m "feat(server): store chord shape overrides per song and globally"
```

---

## Task 2: Overrides in die Griffbild-Auflösung einhängen

**Files:**
- Create: `packages/web/src/music/chordOverrides.ts`
- Create: `packages/web/src/music/chordOverrides.test.ts`
- Modify: `packages/web/src/music/userChords.ts`
- Modify: `packages/web/src/music/userChords.test.ts`
- Modify: `packages/web/src/api/client.ts`

**Interfaces:**
- Consumes: die HTTP-Schnittstelle aus Task 1.
- Produces:
  - `ChordOverrideEntry` — Typ wie in Task 1 beschrieben.
  - `ChordOverrides = { song?: Record<string, ChordShape>; global?: Record<string, ChordShape> }`
  - `toShapeMap(entries: ChordOverrideEntry[]): Record<string, ChordShape>`
  - `resolveChordShape(symbol: string, overrides?: ChordOverrides): ChordShape | null`
  - `api.del<T>(path: string): Promise<T>`

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/music/chordOverrides.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { toShapeMap, type ChordOverrideEntry } from "./chordOverrides.js";

const entry: ChordOverrideEntry = {
  id: 1,
  scope: "global",
  songKey: "",
  symbol: "F#m",
  name: "F#m (leichter)",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
  updatedAt: 0,
};

describe("toShapeMap", () => {
  it("keys the shapes by symbol", () => {
    expect(toShapeMap([entry])["F#m"]).toEqual({
      name: "F#m (leichter)",
      frets: entry.frets,
      fingers: entry.fingers,
      baseFret: 1,
    });
  });

  it("falls back to the symbol when no name is stored", () => {
    expect(toShapeMap([{ ...entry, name: null }])["F#m"]?.name).toBe("F#m");
  });
});
```

Und in `packages/web/src/music/userChords.test.ts` diese Tests anhängen (Import oben um `resolveChordShape` erweitern):

```ts
import { resolveChordShape, resolveUserChords } from "./userChords.js";

const barreShape = {
  name: "F#m eigen",
  frets: [2, 4, 4, 2, 2, 2],
  fingers: [1, 3, 4, 1, 1, 1],
  baseFret: 1,
};

describe("resolveChordShape", () => {
  it("prefers a song override over a global one", () => {
    const shape = resolveChordShape("Em", {
      song: { Em: { ...barreShape, name: "nur hier" } },
      global: { Em: { ...barreShape, name: "überall" } },
    });
    expect(shape?.name).toBe("nur hier");
  });

  it("uses the global override when the song has none", () => {
    const shape = resolveChordShape("Em", { global: { Em: { ...barreShape, name: "überall" } } });
    expect(shape?.name).toBe("überall");
  });

  it("keeps the shipped resolution when no override applies", () => {
    expect(resolveChordShape("Em", { song: {}, global: {} })).toEqual(resolveChordShape("Em"));
    expect(resolveChordShape("Em")?.frets).toHaveLength(6);
  });

  it("returns null for a symbol nothing can resolve", () => {
    expect(resolveChordShape("Hglurb", {})).toBeNull();
  });
});
```

- [ ] **Step 2: Run the tests and watch them fail**

Run: `npm test -- packages/web/src/music`
Expected: FAIL — `./chordOverrides.js` existiert nicht, `resolveChordShape` nimmt kein zweites Argument.

- [ ] **Step 3: Write the override module**

Create `packages/web/src/music/chordOverrides.ts`:

```ts
import type { ChordShape } from "@skills/core";

export interface ChordOverrideEntry {
  id: number;
  scope: "global" | "song";
  songKey: string;
  symbol: string;
  name: string | null;
  frets: (number | null)[];
  fingers: (number | null)[];
  baseFret: number;
  updatedAt: number;
}

/** Shapes that take precedence over everything a skill ships, song level first. */
export interface ChordOverrides {
  song?: Record<string, ChordShape>;
  global?: Record<string, ChordShape>;
}

export function toShapeMap(entries: ChordOverrideEntry[]): Record<string, ChordShape> {
  const map: Record<string, ChordShape> = {};
  for (const entry of entries) {
    map[entry.symbol] = {
      name: entry.name ?? entry.symbol,
      frets: entry.frets,
      fingers: entry.fingers,
      baseFret: entry.baseFret,
    };
  }
  return map;
}
```

- [ ] **Step 4: Extend the resolution**

In `packages/web/src/music/userChords.ts` den Import um den neuen Typ erweitern und `resolveChordShape` ersetzen:

```ts
import type { ChordOverrides } from "./chordOverrides.js";

/**
 * Resolves a chord symbol to a diagram shape with the documented precedence:
 * song override, global override, user-supplied JSON, the open-chord table,
 * a derived movable barre shape, or `null` when none of those apply
 * (see `docs/skills-authoring.md`).
 */
export function resolveChordShape(symbol: string, overrides?: ChordOverrides): ChordShape | null {
  return (
    overrides?.song?.[symbol] ??
    overrides?.global?.[symbol] ??
    userChords()[symbol] ??
    chordShape(symbol) ??
    null
  );
}
```

- [ ] **Step 5: Add the delete helper to the API client**

In `packages/web/src/api/client.ts` im `api`-Objekt ergänzen:

```ts
  del: <T>(path: string) => request<T>(path, { method: "DELETE" }),
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test -- packages/web/src/music`
Expected: PASS.

- [ ] **Step 7: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: alles grün — insbesondere die bestehenden Aufrufer von `resolveChordShape`, die kein zweites Argument übergeben.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/music/chordOverrides.ts packages/web/src/music/chordOverrides.test.ts \
        packages/web/src/music/userChords.ts packages/web/src/music/userChords.test.ts \
        packages/web/src/api/client.ts
git commit -m "feat(web): resolve chord shapes through song and global overrides"
```

---

## Task 3: Der Editor als reine Formularkomponente

**Files:**
- Create: `packages/web/src/music/ChordEditor.tsx`
- Create: `packages/web/src/music/ChordEditor.test.tsx`
- Modify: `packages/web/src/music/ChordDiagramSingle.tsx`

**Interfaces:**
- Consumes: `ChordShape` aus `@skills/core`, `ChordOverrides` aus `./chordOverrides.js`, `ChordDiagramSingle` für die Vorschau.
- Produces:
  - `ChordEditor(props: ChordEditorProps)` mit
    ```ts
    interface ChordEditorProps {
      symbol: string;
      initial: ChordShape | null;
      allowSongScope: boolean;
      canReset?: { song: boolean; global: boolean };
      onSave: (shape: ChordShape, scope: "song" | "global") => void;
      onReset?: (scope: "song" | "global") => void;
      onCancel: () => void;
    }
    ```
  - `ChordDiagramSingle` nimmt zusätzlich `overrides?: ChordOverrides` und `onEdit?: () => void`.

**Bedienregeln:** Raster 6 Saiten × 5 Bünde ab `baseFret`. Klick auf eine Zelle setzt den Punkt dieser Saite auf diesen Bund; erneuter Klick auf denselben Punkt entfernt ihn (Saite wird leer, also `0`). Der Kopfschalter je Saite wechselt zwischen `0` (leer) und `x` (gedämpft) und löscht dabei einen gesetzten Punkt.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/music/ChordEditor.test.tsx`:

```tsx
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
    expect(onSave.mock.calls[0][0].frets[5]).toBe(3);
  });

  it("removes the dot when the same cell is clicked again", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("cell-1-2"));
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0][0].frets[1]).toBe(0);
  });

  it("toggles a string between open and muted", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Em" initial={initial} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByTestId("head-0"));
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0][0].frets[0]).toBeNull();
  });

  it("starts from an empty grid when nothing is stored yet", async () => {
    const onSave = vi.fn();
    render(
      <ChordEditor symbol="Hglurb" initial={null} allowSongScope onSave={onSave} onCancel={vi.fn()} />,
    );
    await userEvent.click(screen.getByRole("button", { name: "In allen Songs" }));
    expect(onSave.mock.calls[0][0].frets).toEqual([0, 0, 0, 0, 0, 0]);
    expect(onSave.mock.calls[0][0].fingers).toEqual([null, null, null, null, null, null]);
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
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- packages/web/src/music/ChordEditor.test.tsx`
Expected: FAIL — `./ChordEditor.js` existiert nicht.

- [ ] **Step 3: Write the editor**

Create `packages/web/src/music/ChordEditor.tsx`:

```tsx
import type { ChordShape } from "@skills/core";
import { useState } from "react";
import { ChordDiagramSingle } from "./ChordDiagramSingle.js";

const STRINGS = [0, 1, 2, 3, 4, 5];
const VISIBLE_FRETS = 5;
const STRING_LABELS = ["E", "A", "D", "G", "H", "e"];

const EMPTY: ChordShape = {
  name: "",
  frets: [0, 0, 0, 0, 0, 0],
  fingers: [null, null, null, null, null, null],
  baseFret: 1,
};

export interface ChordEditorProps {
  symbol: string;
  initial: ChordShape | null;
  allowSongScope: boolean;
  canReset?: { song: boolean; global: boolean };
  onSave: (shape: ChordShape, scope: "song" | "global") => void;
  onReset?: (scope: "song" | "global") => void;
  onCancel: () => void;
}

export function ChordEditor({
  symbol,
  initial,
  allowSongScope,
  canReset,
  onSave,
  onReset,
  onCancel,
}: ChordEditorProps) {
  const start = initial ?? EMPTY;
  const [frets, setFrets] = useState<(number | null)[]>([...start.frets]);
  const [fingers, setFingers] = useState<(number | null)[]>([...start.fingers]);
  const [baseFret, setBaseFret] = useState(start.baseFret);
  const [name, setName] = useState(initial?.name ?? "");

  function update(stringIndex: number, fret: number | null, finger: number | null) {
    setFrets((current) => current.map((value, i) => (i === stringIndex ? fret : value)));
    setFingers((current) => current.map((value, i) => (i === stringIndex ? finger : value)));
  }

  function toggleCell(stringIndex: number, fretNumber: number) {
    if (frets[stringIndex] === fretNumber) update(stringIndex, 0, null);
    else update(stringIndex, fretNumber, fingers[stringIndex] ?? 1);
  }

  function toggleHead(stringIndex: number) {
    update(stringIndex, frets[stringIndex] === null ? 0 : null, null);
  }

  const preview: ChordShape = { name: name || symbol, frets, fingers, baseFret };

  return (
    <div className="space-y-4 rounded border border-slate-300 p-4 dark:border-slate-700">
      <h3 className="text-lg font-medium">Griffbild für {symbol}</h3>

      <div className="flex flex-wrap items-end gap-4">
        <label className="flex flex-col text-sm">
          <span>Anzeigename</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={symbol}
            className="mt-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <label className="flex flex-col text-sm">
          <span>Startbund</span>
          <input
            type="number"
            min={1}
            max={24}
            value={baseFret}
            onChange={(e) => setBaseFret(Math.min(24, Math.max(1, Number(e.target.value) || 1)))}
            className="mt-1 w-20 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
      </div>

      <div>
        <div className="flex gap-1 text-center text-xs">
          {STRINGS.map((stringIndex) => (
            <button
              key={stringIndex}
              type="button"
              data-testid={`head-${stringIndex}`}
              onClick={() => toggleHead(stringIndex)}
              aria-label={`Saite ${STRING_LABELS[stringIndex]} leer oder gedämpft`}
              className="w-8 rounded border border-slate-300 py-0.5 dark:border-slate-700"
            >
              {frets[stringIndex] === null ? "x" : frets[stringIndex] === 0 ? "0" : "·"}
            </button>
          ))}
        </div>

        <div className="mt-1 space-y-1">
          {Array.from({ length: VISIBLE_FRETS }, (_, row) => {
            const fretNumber = baseFret + row;
            return (
              <div key={fretNumber} className="flex gap-1">
                {STRINGS.map((stringIndex) => {
                  const set = frets[stringIndex] === fretNumber;
                  return (
                    <button
                      key={stringIndex}
                      type="button"
                      data-testid={`cell-${stringIndex}-${fretNumber}`}
                      onClick={() => toggleCell(stringIndex, fretNumber)}
                      aria-label={`Saite ${STRING_LABELS[stringIndex]}, Bund ${fretNumber}`}
                      className={`h-8 w-8 rounded-full border text-xs ${
                        set
                          ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                          : "border-slate-200 dark:border-slate-800"
                      }`}
                    >
                      {set ? (fingers[stringIndex] ?? "") : ""}
                    </button>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-wrap gap-3 text-sm">
        {STRINGS.filter((i) => typeof frets[i] === "number" && frets[i] !== 0).map((stringIndex) => (
          <label key={stringIndex} className="flex items-center gap-1">
            <span>{STRING_LABELS[stringIndex]}</span>
            <select
              value={fingers[stringIndex] ?? 1}
              aria-label={`Finger für Saite ${STRING_LABELS[stringIndex]}`}
              onChange={(e) => update(stringIndex, frets[stringIndex], Number(e.target.value))}
              className="rounded border border-slate-300 px-1 py-0.5 dark:border-slate-700 dark:bg-slate-900"
            >
              {[1, 2, 3, 4].map((finger) => (
                <option key={finger} value={finger}>
                  {finger}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      <div>
        <div className="mb-1 text-xs uppercase tracking-wide text-slate-500">Vorschau</div>
        <div className="max-w-[14rem]">
          <ChordDiagramSingle name={symbol} overrides={{ song: { [symbol]: preview } }} />
        </div>
      </div>

      <div className="flex flex-wrap gap-2 text-sm">
        {allowSongScope ? (
          <button
            type="button"
            onClick={() => onSave(preview, "song")}
            className="rounded bg-slate-900 px-3 py-1 text-white dark:bg-slate-100 dark:text-slate-900"
          >
            Nur in diesem Song
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => onSave(preview, "global")}
          className="rounded bg-slate-900 px-3 py-1 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          In allen Songs
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          Abbrechen
        </button>
        {canReset?.song && onReset ? (
          <button
            type="button"
            onClick={() => onReset("song")}
            className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          >
            Griff für diesen Song zurücksetzen
          </button>
        ) : null}
        {canReset?.global && onReset ? (
          <button
            type="button"
            onClick={() => onReset("global")}
            className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          >
            Globalen Griff zurücksetzen
          </button>
        ) : null}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Teach the diagram about overrides and editing**

In `packages/web/src/music/ChordDiagramSingle.tsx`:

```tsx
import type { ChordOverrides } from "./chordOverrides.js";

export function ChordDiagramSingle({
  name,
  overrides,
  onEdit,
}: {
  name: string;
  overrides?: ChordOverrides;
  onEdit?: () => void;
}) {
  const shape = resolveChordShape(name, overrides);
  // …
}
```

Die Überschrift bleibt das Symbol — `chordNotes(name)` und die bestehenden Tests hängen daran. Ein
abweichender Anzeigename aus einem Override oder einer Akkorddatei erscheint als Unterzeile, direkt
nach der Überschriftenzeile im normalen Zweig:

```tsx
      {shape.name !== name ? (
        <p data-testid="shape-name" className="text-xs text-slate-500 dark:text-slate-400">
          {shape.name}
        </p>
      ) : null}
```

Beide Rückgabezweige (fehlendes Griffbild und normales Griffbild) bekommen am Ende ihres Wurzel-`div` denselben Block:

```tsx
      {onEdit ? (
        <button
          type="button"
          onClick={onEdit}
          className="mt-2 text-xs text-slate-500 underline dark:text-slate-400"
        >
          Griff bearbeiten
        </button>
      ) : null}
```

- [ ] **Step 5: Cover the new diagram behaviour**

An `packages/web/src/music/ChordDiagramSingle.test.tsx` anhängen:

```tsx
  it("shows a differing display name underneath the symbol", () => {
    render(
      <ChordDiagramSingle
        name="Em"
        overrides={{ song: { Em: { name: "Em eigen", frets: [0, 2, 2, 0, 0, 0], fingers: [null, 2, 3, null, null, null], baseFret: 1 } } }}
      />,
    );
    expect(screen.getByRole("heading", { name: "Em" })).toBeInTheDocument();
    expect(screen.getByTestId("shape-name")).toHaveTextContent("Em eigen");
  });

  it("offers an edit button only when an edit handler is given", () => {
    const { rerender } = render(<ChordDiagramSingle name="Em" />);
    expect(screen.queryByRole("button", { name: "Griff bearbeiten" })).not.toBeInTheDocument();
    rerender(<ChordDiagramSingle name="Em" onEdit={() => {}} />);
    expect(screen.getByRole("button", { name: "Griff bearbeiten" })).toBeInTheDocument();
  });

  it("keeps the fallback tile editable so a missing shape can be created", () => {
    render(<ChordDiagramSingle name="Xdim7" onEdit={() => {}} />);
    expect(screen.getByText(/kein Griffbild/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Griff bearbeiten" })).toBeInTheDocument();
  });
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test -- packages/web/src/music`
Expected: PASS — `ChordEditor.test.tsx` und die erweiterten `ChordDiagramSingle`-Tests.

- [ ] **Step 7: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add packages/web/src/music/ChordEditor.tsx packages/web/src/music/ChordEditor.test.tsx \
        packages/web/src/music/ChordDiagramSingle.tsx packages/web/src/music/ChordDiagramSingle.test.tsx
git commit -m "feat(web): add a chord shape editor with per-scope saving"
```

---

## Task 4: Editor in der Song-Ansicht

**Files:**
- Create: `packages/web/src/music/useChordOverrides.ts`
- Modify: `packages/web/src/features/songs/SongView.tsx`
- Modify: `packages/web/src/features/songs/SongView.test.tsx`

**Interfaces:**
- Consumes: `api` aus `../api/client.js`, `toShapeMap`/`ChordOverrideEntry` aus Task 2, `ChordEditor` aus Task 3.
- Produces:
  - `useChordOverrides(songKey?: string)` →
    ```ts
    {
      overrides: ChordOverrides;
      entries: { song: ChordOverrideEntry[]; global: ChordOverrideEntry[] };
      save: (symbol: string, shape: ChordShape, scope: "song" | "global") => Promise<void>;
      reset: (symbol: string, scope: "song" | "global") => Promise<void>;
    }
    ```
  - `SongView` nimmt zusätzlich `songKey?: string`.

- [ ] **Step 1: Write the failing test**

In `packages/web/src/features/songs/SongView.test.tsx` den Renderaufbau auf einen Query-Provider umstellen und einen Test ergänzen. Kopf der Datei:

```tsx
import { parseSong } from "@skills/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SongView } from "./SongView.js";

vi.mock("../../audio/useMetronome.js", () => ({
  useMetronome: () => ({
    bpm: 80, setBpm: vi.fn(), beatsPerBar: 4, setBeatsPerBar: vi.fn(),
    running: false, start: vi.fn(), stop: vi.fn(), tap: vi.fn(), currentBeat: 0,
  }),
}));

const song = parseSong(`{title: Übung in Em}
{start_of_verse}
[Em]Erste Zeile mit [Am]zwei Akkorden
{end_of_verse}`);

function renderSong(props: { songKey?: string } = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <SongView song={song} {...props} />
    </QueryClientProvider>,
  );
}

afterEach(() => vi.unstubAllGlobals());
```

Jedes bestehende `render(<SongView song={song} />)` durch `renderSong()` ersetzen. Dann diese Tests anhängen:

```tsx
  it("shows an override instead of the shipped shape", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            global: [],
            song: [
              {
                id: 1, scope: "song", songKey: "song:1", symbol: "Em",
                name: "Em (eigene Version)", frets: [0, 2, 2, 0, 0, 0],
                fingers: [null, 2, 3, null, null, null], baseFret: 1, updatedAt: 0,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    renderSong({ songKey: "song:1" });
    // The heading stays the symbol; the stored display name shows up underneath it.
    expect(await screen.findByText("Em (eigene Version)")).toBeInTheDocument();
  });

  it("opens the editor for a chord", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(JSON.stringify({ global: [], song: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      ),
    );

    renderSong({ songKey: "song:1" });
    const buttons = await screen.findAllByRole("button", { name: "Griff bearbeiten" });
    await userEvent.click(buttons[0]!);
    expect(screen.getByRole("heading", { name: /Griffbild für/ })).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- packages/web/src/features/songs/SongView.test.tsx`
Expected: FAIL — `SongView` kennt weder `songKey` noch eine Bearbeiten-Schaltfläche.

- [ ] **Step 3: Write the hook**

Create `packages/web/src/music/useChordOverrides.ts`:

```ts
import type { ChordShape } from "@skills/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client.js";
import { toShapeMap, type ChordOverrideEntry, type ChordOverrides } from "./chordOverrides.js";

interface ChordListResponse {
  global: ChordOverrideEntry[];
  song: ChordOverrideEntry[];
}

const EMPTY: ChordListResponse = { global: [], song: [] };

/**
 * Loads the override entries that apply to one song (or, without a key, only the
 * global ones) and writes changes back through `/api/chords`.
 */
export function useChordOverrides(songKey?: string) {
  const client = useQueryClient();
  const key = ["chords", songKey ?? null];

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      api.get<ChordListResponse>(songKey ? `/api/chords?songKey=${encodeURIComponent(songKey)}` : "/api/chords"),
  });

  const invalidate = () => client.invalidateQueries({ queryKey: ["chords"] });

  const saveMutation = useMutation({
    mutationFn: (input: { symbol: string; shape: ChordShape; scope: "song" | "global" }) =>
      api.put("/api/chords", {
        scope: input.scope,
        songKey: input.scope === "song" ? songKey : undefined,
        symbol: input.symbol,
        name: input.shape.name || undefined,
        frets: input.shape.frets,
        fingers: input.shape.fingers,
        baseFret: input.shape.baseFret,
      }),
    onSuccess: invalidate,
  });

  const resetMutation = useMutation({
    mutationFn: (input: { symbol: string; scope: "song" | "global" }) => {
      const params = new URLSearchParams({ scope: input.scope, symbol: input.symbol });
      if (input.scope === "song" && songKey) params.set("songKey", songKey);
      return api.del(`/api/chords?${params.toString()}`);
    },
    onSuccess: invalidate,
  });

  const entries = query.data ?? EMPTY;

  return {
    entries,
    overrides: {
      song: toShapeMap(entries.song),
      global: toShapeMap(entries.global),
    } satisfies ChordOverrides,
    async save(symbol: string, shape: ChordShape, scope: "song" | "global") {
      await saveMutation.mutateAsync({ symbol, shape, scope });
    },
    async reset(symbol: string, scope: "song" | "global") {
      await resetMutation.mutateAsync({ symbol, scope });
    },
  };
}
```

- [ ] **Step 4: Wire the song view**

In `packages/web/src/features/songs/SongView.tsx`:

```tsx
import { ChordEditor } from "../../music/ChordEditor.js";
import { useChordOverrides } from "../../music/useChordOverrides.js";
import { resolveChordShape } from "../../music/userChords.js";

export function SongView({ song, songKey }: { song: Song; songKey?: string }) {
  // … bestehende States …
  const [editing, setEditing] = useState<string | null>(null);
  const { overrides, entries, save, reset } = useChordOverrides(songKey);
```

Der Akkordraster-Block wird zu:

```tsx
      {shown.chordsUsed.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.chordsUsed.map((chord) => (
            <ChordDiagramSingle
              key={chord}
              name={chord}
              overrides={overrides}
              onEdit={() => setEditing(chord)}
            />
          ))}
        </div>
      ) : null}

      {editing ? (
        <ChordEditor
          symbol={editing}
          initial={resolveChordShape(editing, overrides)}
          allowSongScope={Boolean(songKey)}
          canReset={{
            song: entries.song.some((entry) => entry.symbol === editing),
            global: entries.global.some((entry) => entry.symbol === editing),
          }}
          onSave={async (shape, scope) => {
            await save(editing, shape, scope);
            setEditing(null);
          }}
          onReset={async (scope) => {
            await reset(editing, scope);
            setEditing(null);
          }}
          onCancel={() => setEditing(null)}
        />
      ) : null}
```

- [ ] **Step 5: Run the test and watch it pass**

Run: `npm test -- packages/web/src/features/songs/SongView.test.tsx`
Expected: PASS, alle Tests der Datei.

- [ ] **Step 6: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: alles grün. `SongImport.tsx` rendert `SongView` weiterhin ohne `songKey` — dort erscheint nur „In allen Songs".

- [ ] **Step 7: Commit**

```bash
git add packages/web/src/music/useChordOverrides.ts \
        packages/web/src/features/songs/SongView.tsx \
        packages/web/src/features/songs/SongView.test.tsx
git commit -m "feat(web): edit chord shapes from inside the song view"
```

---

## Task 5: Song-Schlüssel und zentrale Verwaltung

**Files:**
- Modify: `skills/guitar/widgets/SongLibrary.tsx`
- Modify: `skills/guitar/widgets/ChordDiagram.tsx`
- Modify: `skills/guitar/widgets/ChordDiagram.test.tsx`

**Interfaces:**
- Consumes: `useChordOverrides` (Task 4), `ChordEditor` (Task 3), `api` (Task 2), `GET /api/chords?all=1` (Task 1).
- Produces: nichts, worauf spätere Aufgaben aufbauen.

- [ ] **Step 1: Write the failing test**

An `skills/guitar/widgets/ChordDiagram.test.tsx` anhängen (Kopf bei Bedarf um `QueryClient`, `QueryClientProvider`, `userEvent`, `vi` erweitern; der bestehende Renderaufruf wird in eine `renderWidget()`-Hilfe mit Provider gezogen):

```tsx
  it("lists the stored overrides on the second tab", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            entries: [
              {
                id: 1, scope: "global", songKey: "", symbol: "Cadd9", name: "Cadd9 eigen",
                frets: [null, 3, 2, 0, 3, 0], fingers: [null, 3, 2, null, 4, null],
                baseFret: 1, updatedAt: 0,
              },
            ],
          }),
          { status: 200, headers: { "content-type": "application/json" } },
        ),
      ),
    );

    renderWidget();
    await userEvent.click(screen.getByRole("button", { name: "Eigene Griffe" }));
    expect(await screen.findByText("Cadd9 eigen")).toBeInTheDocument();
    expect(screen.getByText("Alle Songs")).toBeInTheDocument();
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- skills/guitar/widgets/ChordDiagram.test.tsx`
Expected: FAIL — der Reiter „Eigene Griffe" existiert nicht.

- [ ] **Step 3: Pass the song key through the library**

In `skills/guitar/widgets/SongLibrary.tsx` den geöffneten Song samt Schlüssel merken:

```tsx
  const [open, setOpen] = useState<{ song: Song; key: string } | null>(null);
```

Der Rückwärtsknopf-Block wird zu:

```tsx
        <SongView song={open.song} songKey={open.key} />
```

und die beiden Öffnen-Aufrufe zu:

```tsx
                onClick={() => setOpen({ song: parseSong(stueck.quelle), key: `uebung:${stueck.id}` })}
```

```tsx
                  onClick={() => setOpen({ song: parseSong(song.content), key: `song:${song.id}` })}
```

- [ ] **Step 4: Add the management tab**

`skills/guitar/widgets/ChordDiagram.tsx` neu schreiben:

```tsx
import { OPEN_CHORDS } from "@skills/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { api } from "../../../packages/web/src/api/client.js";
import type { ChordOverrideEntry } from "../../../packages/web/src/music/chordOverrides.js";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import { ChordEditor } from "../../../packages/web/src/music/ChordEditor.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

interface StoredSong {
  id: number;
  title: string;
}

function OwnShapes() {
  const client = useQueryClient();
  const [editing, setEditing] = useState<{ symbol: string; entry: ChordOverrideEntry | null } | null>(null);
  const [newSymbol, setNewSymbol] = useState("");

  const overrides = useQuery({
    queryKey: ["chords", "all"],
    queryFn: () => api.get<{ entries: ChordOverrideEntry[] }>("/api/chords?all=1"),
  });
  const songs = useQuery({
    queryKey: ["songs"],
    queryFn: () => api.get<{ songs: StoredSong[] }>("/api/songs"),
  });

  const entries = overrides.data?.entries ?? [];

  function scopeLabel(entry: ChordOverrideEntry) {
    if (entry.scope === "global") return "Alle Songs";
    const id = Number(entry.songKey.replace(/^song:/, ""));
    const song = songs.data?.songs.find((s) => s.id === id);
    return song ? `Nur „${song.title}"` : `Nur ${entry.songKey}`;
  }

  async function remove(entry: ChordOverrideEntry) {
    const params = new URLSearchParams({ scope: entry.scope, symbol: entry.symbol });
    if (entry.scope === "song") params.set("songKey", entry.songKey);
    await api.del(`/api/chords?${params.toString()}`);
    await client.invalidateQueries({ queryKey: ["chords"] });
  }

  if (editing) {
    return (
      <ChordEditor
        symbol={editing.symbol}
        initial={
          editing.entry
            ? {
                name: editing.entry.name ?? editing.entry.symbol,
                frets: editing.entry.frets,
                fingers: editing.entry.fingers,
                baseFret: editing.entry.baseFret,
              }
            : null
        }
        allowSongScope={false}
        onSave={async (shape) => {
          await api.put("/api/chords", {
            scope: "global",
            symbol: editing.symbol,
            name: shape.name || undefined,
            frets: shape.frets,
            fingers: shape.fingers,
            baseFret: shape.baseFret,
          });
          await client.invalidateQueries({ queryKey: ["chords"] });
          setEditing(null);
        }}
        onCancel={() => setEditing(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-2 text-sm">
        <label className="flex flex-col">
          <span>Neuer Akkord</span>
          <input
            value={newSymbol}
            onChange={(e) => setNewSymbol(e.target.value)}
            placeholder="z. B. Dsus4"
            className="mt-1 rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
          />
        </label>
        <button
          type="button"
          disabled={newSymbol.trim() === ""}
          onClick={() => setEditing({ symbol: newSymbol.trim(), entry: null })}
          className="rounded border border-slate-300 px-3 py-1 disabled:opacity-50 dark:border-slate-700"
        >
          Anlegen
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Noch keine eigenen Griffe. Lege hier einen an oder bearbeite ein Griffbild direkt in einem Song.
        </p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => (
            <li
              key={entry.id}
              className="flex flex-wrap items-center justify-between gap-2 rounded border border-slate-200 p-3 text-sm dark:border-slate-800"
            >
              <span>
                <span className="font-medium">{entry.name ?? entry.symbol}</span>
                <span className="ml-2 text-slate-500">{scopeLabel(entry)}</span>
              </span>
              <span className="flex gap-2">
                {entry.scope === "global" ? (
                  <button
                    type="button"
                    onClick={() => setEditing({ symbol: entry.symbol, entry })}
                    className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                  >
                    Bearbeiten
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => remove(entry)}
                  className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700"
                >
                  Löschen
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function ChordDiagram(_: WidgetProps) {
  const [tab, setTab] = useState<"offen" | "eigene">("offen");

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Akkordgriffe</h1>

      <div className="flex gap-2 text-sm">
        {(["offen", "eigene"] as const).map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`rounded border px-3 py-1 ${
              tab === value ? "border-slate-900 dark:border-slate-100" : "border-slate-300 dark:border-slate-700"
            }`}
          >
            {value === "offen" ? "Offene Akkorde" : "Eigene Griffe"}
          </button>
        ))}
      </div>

      {tab === "offen" ? (
        <>
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Von links nach rechts: tiefe E-Saite bis hohe E-Saite. x heißt nicht anschlagen, 0 heißt
            leer spielen. Die Zahl im Punkt ist der Finger: 1 Zeigefinger, 4 kleiner Finger.
          </p>
          <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Object.keys(OPEN_CHORDS).map((name) => (
              <ChordDiagramSingle key={name} name={name} />
            ))}
          </div>
        </>
      ) : (
        <OwnShapes />
      )}
    </div>
  );
}
```

Ein songbezogener Eintrag lässt sich hier nur löschen, nicht bearbeiten — bearbeitet wird er im Song selbst, wo der Kontext stimmt.

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npm test -- skills/guitar/widgets`
Expected: PASS.

- [ ] **Step 6: Run the whole suite and the type check**

Run: `npm test && npm run typecheck`
Expected: alles grün.

- [ ] **Step 7: Commit**

```bash
git add skills/guitar/widgets/SongLibrary.tsx skills/guitar/widgets/ChordDiagram.tsx \
        skills/guitar/widgets/ChordDiagram.test.tsx
git commit -m "feat(guitar): manage own chord shapes and scope them per song"
```

---

## Task 6: Ende-zu-Ende-Test und Dokumentation

**Files:**
- Modify: `e2e/guitar.spec.ts`
- Modify: `docs/skills-authoring.md`
- Modify: `README.md`

**Interfaces:**
- Consumes: die fertige Oberfläche aus den Tasks 1–5.
- Produces: nichts.

- [ ] **Step 1: Write the failing end-to-end test**

An `e2e/guitar.spec.ts` anhängen:

```ts
test("a chord shape edited for one song survives reopening it", async ({ page }) => {
  await page.goto("/skill/guitar/songs");
  await page.getByRole("button", { name: /Zwei Akkorde, eine Wiege/ }).click();

  await page.getByRole("button", { name: "Griff bearbeiten" }).first().click();
  await expect(page.getByRole("heading", { name: /Griffbild für/ })).toBeVisible();

  await page.getByLabel("Anzeigename").fill("Em nach meiner Art");
  await page.getByRole("button", { name: "Nur in diesem Song" }).click();

  await expect(page.getByText("Em nach meiner Art").first()).toBeVisible();

  await page.getByRole("button", { name: /Zurück zur Bibliothek/ }).click();
  await page.getByRole("button", { name: /Zwei Akkorde, eine Wiege/ }).click();
  await expect(page.getByText("Em nach meiner Art").first()).toBeVisible();
});
```

- [ ] **Step 2: Run it and watch it pass**

Run: `npm run test:e2e -- e2e/guitar.spec.ts`
Expected: PASS. Falls der Test rot ist, liegt der Fehler in den Tasks 1–5 und wird dort behoben, nicht durch Abschwächen des Tests.

- [ ] **Step 3: Document the precedence**

In `docs/skills-authoring.md` den Abschnitt zur Griffbild-Auflösung auf die neue, sechsstufige Reihenfolge bringen:

```markdown
Ein Akkordsymbol wird in dieser Reihenfolge aufgelöst:

1. Griff, den du in der Oberfläche für genau diesen Song gespeichert hast
2. Griff, den du in der Oberfläche für alle Songs gespeichert hast
3. `skills/<skill>/chords/*.json`
4. mitgelieferte offene Akkorde
5. abgeleitetes Barré-Griffbild
6. kein Griffbild — die Kachel bleibt klickbar und legt beim Bearbeiten einen neuen Griff an

Die Stufen 1 und 2 liegen in `data/app.db` und werden von der Sicherung erfasst. Der Server
schreibt nie in `chords/*.json` — diese Dateien bleiben der von Hand gepflegte Weg.
```

- [ ] **Step 4: Mention it in the readme**

In `README.md` unter „Mitgelieferte Lernbereiche" den Gitarre-Satz ergänzen um: „Griffbilder lassen sich direkt im Song ändern — wahlweise nur für diesen Song oder für alle."

- [ ] **Step 5: Run everything once more**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: alles grün.

- [ ] **Step 6: Commit**

```bash
git add e2e/guitar.spec.ts docs/skills-authoring.md README.md
git commit -m "test(e2e): cover song-scoped chord editing and document the precedence"
```

---

## Task 7: Japanisch-Kurs — Block Schrift (Lektionen 1–7)

**Files:**
- Create: `skills/japanese/lessons/01-aussprache.mdx` … `07-katakana.mdx`
- Create: `skills/japanese/lessons/lessons.test.ts`
- Modify: `skills/japanese/skill.json`

**Interfaces:**
- Consumes: MDX-Bausteine aus `packages/web/src/mdx/components.tsx` — `Ziel`, `Merksatz`, `Fehlerbild`, `Uebung`, `Hinweis`, `Checkpoint`. `Handhaltung` ist gitarrenspezifisch und kommt nicht vor. `Uebung` ohne `bpm`.
- Produces: die Lektionskette, an die Task 8 mit `requires: "07-katakana"` anschließt.

**Formvorgaben für jede Lektion dieses und aller folgenden Japanisch-Tasks:**
- Erste Zeile: `export const meta = { id: "<dateiname ohne .mdx>", title: "<Titel>", order: <n>, requires: <"vorige id" | null> };`
- Pflichtblöcke: `<Ziel>`, `<Fehlerbild>`, `<Uebung>` (mit Lösungen im selben Block), `<Checkpoint>`.
- `<Merksatz>` und `<Hinweis>` nach Bedarf.
- Erklärungen deutsch, Merksätze bildhaft und deutsch gedacht — keine Übersetzungen englischer Eselsbrücken (Entscheidungsprotokoll 2026-08-06).
- Japanische Beispiele stehen in Kana, jeweils mit deutscher Übersetzung nach einem Gedankenstrich.
- Wo ein bestehendes Modul dasselbe vertieft, ein Satz Verweis statt Wiederholung, z. B. „Die vollständige Tabelle steht im Modul Hiragana." oder „Mehr dazu im Modul Grammatik & Sätze, Lektion 02."

- [ ] **Step 1: Write the failing test**

Create `skills/japanese/lessons/lessons.test.ts`:

```ts
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const files = readdirSync(here).filter((name) => name.endsWith(".mdx")).sort();

function meta(file: string) {
  const source = readFileSync(join(here, file), "utf8");
  const match = /export const meta = (\{[\s\S]*?\});/.exec(source);
  if (!match) throw new Error(`${file} ohne meta-Export`);
  // eslint-disable-next-line no-new-func
  return new Function(`return ${match[1]}`)() as {
    id: string;
    title: string;
    order: number;
    requires: string | null;
  };
}

describe("japanese lessons", () => {
  it("ships at least the writing block", () => {
    expect(files.length).toBeGreaterThanOrEqual(7);
  });

  it("orders them continuously and chains the prerequisites", () => {
    const metas = files.map(meta);
    expect(metas.map((m) => m.order)).toEqual(metas.map((_, i) => i + 1));
    expect(metas[0]!.requires).toBeNull();
    for (let i = 1; i < metas.length; i += 1) {
      expect(metas[i]!.requires).toBe(metas[i - 1]!.id);
    }
  });

  it("names every lesson after its file", () => {
    for (const file of files) {
      expect(meta(file).id).toBe(file.replace(/\.mdx$/, ""));
    }
  });

  for (const file of files) {
    it(`${file} carries goal, error case, exercise and checkpoint`, () => {
      const source = readFileSync(join(here, file), "utf8");
      for (const block of ["<Ziel>", "<Fehlerbild>", "<Uebung>", "<Checkpoint>"]) {
        expect(source, `${file} ohne ${block}`).toContain(block);
      }
    });
  }

  it("keeps the guitar-only block out of the japanese course", () => {
    for (const file of files) {
      expect(readFileSync(join(here, file), "utf8")).not.toContain("<Handhaltung>");
    }
  });
});
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- skills/japanese/lessons`
Expected: FAIL — das Verzeichnis enthält keine MDX-Dateien, `files.length` ist 0.

- [ ] **Step 3: Write lesson 1 as the template for all others**

Create `skills/japanese/lessons/01-aussprache.mdx`:

```mdx
export const meta = { id: "01-aussprache", title: "Aussprache und Mora", order: 1, requires: null };

<Ziel>Du sprichst die fünf japanischen Vokale sauber aus und zählst einen Wortrhythmus in Moren statt in Silben.</Ziel>

Japanisch kennt fünf Vokale: あ (a), い (i), う (u), え (e), お (o). Sie klingen kurz und klar wie
im Deutschen in „Bahn, Biene, Buch, Bett, Boot" — nur ohne die Längung. う ist dabei weniger
gerundet als das deutsche u.

Der Takt der Sprache ist die **Mora**, nicht die Silbe. Jedes Kana ist genau eine Mora und dauert
gleich lang. とうきょう (Tokio) hat vier Moren: と-う-きょ-う — nicht zwei Silben.

<Merksatz>Jedes Zeichen ein Schlag. Wer Japanisch spricht, klopft ein gleichmäßiges Metronom.</Merksatz>

<Fehlerbild>
Deutschsprachige betonen einzelne Silben und ziehen sie dabei in die Länge, wie in „To-KIO".
Im Japanischen bleibt jede Mora gleich lang; Betonung entsteht über die Tonhöhe, nicht über Länge
oder Lautstärke.
</Fehlerbild>

<Hinweis>Zwischen Konsonant und Vokal steht nie eine Konsonantenhäufung: japanische Moren sind fast
immer Vokal oder Konsonant plus Vokal. Einzige Ausnahme ist ん.</Hinweis>

<Uebung>
Klopfe den Takt mit und sprich jede Mora gleich lang:
1. あおい (blau) — drei Moren
2. とうきょう (Tokio) — vier Moren
3. せんせい (Lehrer) — vier Moren

Lösungen: 1. a-o-i — 2. to-u-kyo-u — 3. se-n-se-i.
</Uebung>

<Checkpoint>Du sprichst あおい und とうきょう mit gleichmäßiger Morenlänge und kannst erklären, warum とうきょう vier Moren hat.</Checkpoint>
```

- [ ] **Step 4: Write the remaining six lessons of the block**

Dieselbe Form, Inhalte nach dieser Tabelle. `requires` ist jeweils die `id` der vorigen Lektion.

| Datei | id / title | Inhalt |
| --- | --- | --- |
| `02-hiragana-a-na.mdx` | `02-hiragana-a-na` / „Hiragana あ bis の" | Die Reihen あ, か, さ, た, な. Je Zeichen ein bildhafter deutscher Merksatz (z. B. き wie ein Schlüssel mit zwei Bärten). Schreibrichtung: oben nach unten, links nach rechts. Übung: fünf Wörter aus diesen Zeichen lesen (かき Kaki, さかな Fisch, たなか Tanaka, なに was, あかい rot). Verweis auf das Modul Hiragana für die vollständige Tabelle. |
| `03-hiragana-ha-n.mdx` | `03-hiragana-ha-n` / „Hiragana は bis ん" | Reihen は, ま, や, ら, わ plus ん. Besonderheit: や, ゆ, よ haben keine i- und e-Formen; ん ist die einzige Mora ohne Vokal und steht nie am Wortanfang. Übung: Wörter lesen (やま Berg, ほん Buch, みらい Zukunft, わたし ich). |
| `04-dakuten.mdx` | `04-dakuten` / „Dakuten und Handakuten" | ゛macht か→が, さ→ざ, た→だ, は→ば; ゜macht は→ぱ. Rendaku als Vorschau anreißen und auf das Modul „Sonderfälle beim Lesen" verweisen. Fehlerbild: じ und ぢ klingen gleich, geschrieben wird fast immer じ. Übung: がっこう, ぶんか, ぴかぴか lesen. |
| `05-yoon.mdx` | `05-yoon` / „Yōon — kleine や, ゆ, よ" | きゃ/きゅ/きょ und Verwandte: ein großes i-Kana plus kleines ya/yu/yo bilden **eine** Mora. Fehlerbild: きよ (zwei Moren) gegen きょ (eine Mora) — Bedeutungsunterschied. Übung: びょういん (Krankenhaus) gegen びよういん (Friseursalon). |
| `06-sokuon-choon.mdx` | `06-sokuon-choon` / „Kleines っ und lange Vokale" | Kleines っ verdoppelt den folgenden Konsonanten und belegt selbst eine Mora Pause: きって (Briefmarke) gegen きて (komm). Lange Vokale in Hiragana über zusätzliches う oder あ, in Katakana über ー. Übung: Minimalpaare sprechen (おばさん Tante / おばあさん Großmutter). |
| `07-katakana.mdx` | `07-katakana` / „Katakana" | Wofür Katakana steht: Fremdwörter, Namen, Lautmalerei, Betonung. Formähnlichkeiten zu Hiragana (か/カ, せ/セ) und die klassischen Verwechslungspaare シ/ツ und ソ/ン über die Strichrichtung unterscheiden. Übung: コーヒー, テレビ, ドイツ lesen. Verweis auf das Modul Katakana. |

- [ ] **Step 5: Register the module**

In `skills/japanese/skill.json` als **erstes** Element von `modules` einfügen:

```json
    { "id": "kurs", "type": "course", "title": "Kurs", "subtitle": "30 Lektionen, aufeinander aufbauend", "data": ["lessons/*.mdx"] },
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npm test -- skills/japanese`
Expected: PASS — sieben Lektionen, lückenlose Ordnung, alle Pflichtblöcke vorhanden.

- [ ] **Step 7: Verify the registry accepts the new module**

Run: `npm test && npm run typecheck`
Expected: alles grün, insbesondere `packages/web/src/skills/registry.test.ts` — das Wildcard-Muster `lessons/*.mdx` löst keinen „fehlt"-Fehler aus.

- [ ] **Step 8: Commit**

```bash
git add skills/japanese/lessons skills/japanese/skill.json
git commit -m "feat(japanese): add the writing block of the beginners course"
```

---

## Task 8: Japanisch-Kurs — Block Erste Sätze (Lektionen 8–12)

**Files:**
- Create: `skills/japanese/lessons/08-satzbau.mdx` … `12-fragen.mdx`

**Interfaces:**
- Consumes: die Kette aus Task 7; Lektion 8 hat `requires: "07-katakana"`.
- Produces: `12-fragen` als Anschlusspunkt für Task 9.

Formvorgaben wie in Task 7.

- [ ] **Step 1: Watch the test tighten**

Run: `npm test -- skills/japanese/lessons`
Expected: PASS mit sieben Dateien — der Ausgangszustand. Der Test prüft Kette und Pflichtblöcke bei jeder neuen Datei automatisch mit.

- [ ] **Step 2: Write the five lessons**

| Datei | id / title | Inhalt |
| --- | --- | --- |
| `08-satzbau.mdx` | `08-satzbau` / „Satzbau und です" | Verb steht immer am Satzende, Grundreihenfolge Subjekt–Objekt–Verb. です als Kopula nur an Nomen und な-Adjektive. Beispiele: わたしは がくせいです。 — Ich bin Student. Fehlerbild: deutsche Verbzweitstellung. Verweis: Modul Grammatik & Sätze, Lektion 01. |
| `09-wa-ga.mdx` | `09-wa-ga` / „は und が" | は markiert das Thema (was schon bekannt ist), が das Subjekt (was neu oder betont ist). Klassisches Paar: だれが きましたか — たなかさんが きました gegen たなかさんは がくせいです。 Fehlerbild: は als „ist" missverstehen. Verweis: Grammatik-Lektion 02. |
| `10-wo-ni-de.mdx` | `10-wo-ni-de` / „を, に und で" | を markiert das direkte Objekt, に Ziel/Zeitpunkt/Existenzort, で den Ort einer Handlung und das Mittel. Kontrastpaar: がっこうに います (bin in der Schule) gegen がっこうで べんきょうします (lerne in der Schule). Verweis: Grammatik-Lektion 03. |
| `11-no.mdx` | `11-no` / „の und Zugehörigkeit" | A の B heißt „B von A": わたしの ほん (mein Buch), にほんごの せんせい (Japanischlehrer). Verkettung mehrerer の. Fehlerbild: Reihenfolge gegenüber dem Deutschen vertauscht. |
| `12-fragen.mdx` | `12-fragen` / „Fragen mit か und Fragewörtern" | か ans Satzende macht jeden Aussagesatz zur Frage, Wortstellung bleibt gleich, kein Fragezeichen nötig. Fragewörter なに, だれ, どこ, いつ, どう, いくら stehen an der Stelle der gesuchten Information. Fehlerbild: Umstellung wie im Deutschen. Verweis: Grammatik-Lektion 11. |

- [ ] **Step 3: Run the tests and watch them pass**

Run: `npm test -- skills/japanese/lessons`
Expected: PASS mit zwölf Dateien, `order` 1–12, Kette lückenlos.

- [ ] **Step 4: Commit**

```bash
git add skills/japanese/lessons
git commit -m "feat(japanese): add the first-sentences block of the course"
```

---

## Task 9: Japanisch-Kurs — Block Verben (Lektionen 13–18)

**Files:**
- Create: `skills/japanese/lessons/13-verbgruppen.mdx` … `18-teiru.mdx`

**Interfaces:**
- Consumes: Lektion 13 hat `requires: "12-fragen"`.
- Produces: `18-teiru` als Anschlusspunkt für Task 10.

Formvorgaben wie in Task 7.

- [ ] **Step 1: Write the six lessons**

| Datei | id / title | Inhalt |
| --- | --- | --- |
| `13-verbgruppen.mdx` | `13-verbgruppen` / „Die drei Verbgruppen" | Godan (う-Verben), Ichidan (る-Verben), unregelmäßig (する, くる). Erkennungsregel und die Fallen (かえる, はしる sehen aus wie Ichidan, sind aber Godan). Verweis: Grammatik-Lektion 05. |
| `14-masu.mdx` | `14-masu` / „Die ます-Form" | Bildung je Gruppe: Godan u-Reihe → i-Reihe + ます, Ichidan る weg + ます, します/きます. Höflichkeitsebene der ます-Form. Übung: zehn Verben umformen mit Lösungen. |
| `15-verneinung.mdx` | `15-verneinung` / „Verneinung" | ません als höfliche Verneinung, ない-Form als neutrale, じゃありません bei Nomen. Fehlerbild: ない an die ます-Form hängen. Verweis: Grammatik-Lektion 06. |
| `16-vergangenheit.mdx` | `16-vergangenheit` / „Vergangenheit" | ました und ませんでした; bei Nomen でした und じゃありませんでした. Übersicht als Vierfeldertafel (bejaht/verneint × Gegenwart/Vergangenheit). Verweis: Grammatik-Lektion 07. |
| `17-te-form.mdx` | `17-te-form` / „Die て-Form" | Bildungsregeln nach Endung mit dem üblichen Merkvers, Sonderfall いく → いって. Wofür sie gebraucht wird: Sätze verketten, Bitten, Verlaufsform. Verweis: Grammatik-Lektion 09. |
| `18-teiru.mdx` | `18-teiru` / „ている — gerade und dauerhaft" | ています für laufende Handlungen (たべています — ich esse gerade) und für Zustände (けっこんしています — ich bin verheiratet, nicht „ich heirate gerade"). Fehlerbild: ている immer als Verlaufsform lesen. |

- [ ] **Step 2: Run the tests and watch them pass**

Run: `npm test -- skills/japanese/lessons`
Expected: PASS mit achtzehn Dateien.

- [ ] **Step 3: Commit**

```bash
git add skills/japanese/lessons
git commit -m "feat(japanese): add the verb block of the course"
```

---

## Task 10: Japanisch-Kurs — Block Adjektive und Zahlen (Lektionen 19–23)

**Files:**
- Create: `skills/japanese/lessons/19-i-adjektive.mdx` … `23-zaehlwoerter.mdx`

**Interfaces:**
- Consumes: Lektion 19 hat `requires: "18-teiru"`.
- Produces: `23-zaehlwoerter` als Anschlusspunkt für Task 11.

Formvorgaben wie in Task 7.

- [ ] **Step 1: Write the five lessons**

| Datei | id / title | Inhalt |
| --- | --- | --- |
| `19-i-adjektive.mdx` | `19-i-adjektive` / „い-Adjektive" | Endung い, eigene Konjugation: たかい → たかくない → たかかった → たかくなかった. Kein です zum Konjugieren nötig, です nur als Höflichkeitsmarker. Fehlerbild: たかいでした. Verweis: Grammatik-Lektion 08. |
| `20-na-adjektive.mdx` | `20-na-adjektive` / „な-Adjektive" | Verhalten wie Nomen, な nur vor dem Nomen: しずかな へや gegen へやは しずかです。 Konjugation über です/じゃありません. Grenzfälle きれい und ゆうめい, die auf い enden, aber な-Adjektive sind. |
| `21-vergleich.mdx` | `21-vergleich` / „Vergleichen" | AはBより… (A ist …er als B), AとBとどちらが…, いちばん für den Superlativ. Kein eigener Komparativ am Adjektiv. Übung: drei Vergleichssätze bilden. |
| `22-zahlen.mdx` | `22-zahlen` / „Zahlen" | 1–10, die Zehner-, Hunderter- und Tausenderlogik, まん als Zehntausender-Einheit. Lautwechsel bei さんびゃく, ろっぴゃく, はっぴゃく. Doppelformen し/よん, しち/なな, く/きゅう. Verweis: Deck „Zahlen". |
| `23-zaehlwoerter.mdx` | `23-zaehlwoerter` / „Zählwörter" | Warum gezählte Dinge ein Klassifikator brauchen: つ (allgemein), 人 (Personen), 本 (lange Dinge), 枚 (flache Dinge), 匹 (kleine Tiere). Lautveränderungen bei いっぽん, さんぼん, ろっぽん. Fehlerbild: direkt zählen ohne Zählwort. Verweis: Grammatik-Lektion 10. |

- [ ] **Step 2: Run the tests and watch them pass**

Run: `npm test -- skills/japanese/lessons`
Expected: PASS mit dreiundzwanzig Dateien.

- [ ] **Step 3: Commit**

```bash
git add skills/japanese/lessons
git commit -m "feat(japanese): add the adjectives and numbers block of the course"
```

---

## Task 11: Japanisch-Kurs — Block Alltag (Lektionen 24–30), Abschluss und Dokumentation

**Files:**
- Create: `skills/japanese/lessons/24-zeitangaben.mdx` … `30-hoeflichkeit.mdx`
- Modify: `skills/japanese/lessons/lessons.test.ts`
- Modify: `README.md`
- Modify: `PROJECT_LOG.md`

**Interfaces:**
- Consumes: Lektion 24 hat `requires: "23-zaehlwoerter"`.
- Produces: den vollständigen Kurs aus 30 Lektionen.

Formvorgaben wie in Task 7.

- [ ] **Step 1: Tighten the test to the final count**

In `skills/japanese/lessons/lessons.test.ts` den ersten Test ersetzen:

```ts
  it("ships thirty lessons", () => {
    expect(files).toHaveLength(30);
  });
```

- [ ] **Step 2: Run the test and watch it fail**

Run: `npm test -- skills/japanese/lessons`
Expected: FAIL — 23 statt 30 Dateien.

- [ ] **Step 3: Write the seven lessons**

| Datei | id / title | Inhalt |
| --- | --- | --- |
| `24-zeitangaben.mdx` | `24-zeitangaben` / „Zeit und Termine" | Uhrzeit mit じ und ふん samt Lautwechseln (よじ, なながつ, いっぷん), Wochentage, Datum mit den unregelmäßigen Tagen 1–10. に bei absoluten Zeitpunkten, kein に bei きょう, あした, まいにち. |
| `25-wegbeschreibung.mdx` | `25-wegbeschreibung` / „Nach dem Weg fragen" | …は どこですか, Ortsangaben まえ/うしろ/となり/ちかく mit の, Richtungen みぎ/ひだり/まっすぐ, Verben いきます/まがります. Übung: einen kurzen Weg beschreiben. |
| `26-einkaufen.mdx` | `26-einkaufen` / „Einkaufen" | これ/それ/あれ und この/その/あの, いくらですか, ください, これを みっつ ください. Fehlerbild: これ und この verwechseln — これ steht allein, この immer vor einem Nomen. Verweis: Deck „Einkaufen". |
| `27-essen.mdx` | `27-essen` / „Essen und Bestellen" | …を おねがいします, おすすめは なんですか, Mengenangaben mit Zählwörtern, いただきます und ごちそうさまでした. Verweis: Deck „Essen". |
| `28-bitten.mdx` | `28-bitten` / „Bitten und Erlauben" | てください für Bitten, てもいいですか für Erlaubnis, てはいけません für Verbote. Höflichkeitsabstufung von ください bis いただけませんか. Baut direkt auf Lektion 17 auf. |
| `29-wollen-koennen.mdx` | `29-wollen-koennen` / „Wollen und Können" | たい für den eigenen Wunsch (und warum es für dritte Personen nicht direkt geht: たがっている), ほしい für Dinge, できます und die Potentialform für Fähigkeit. Fehlerbild: たい auf andere anwenden. |
| `30-hoeflichkeit.mdx` | `30-hoeflichkeit` / „Höflichkeitsebenen und Abschluss" | Drei Ebenen: neutral, ます-höflich, Keigo als Ausblick. Wann welche Ebene passt. Abschließender Selbsttest über den ganzen Kurs im `<Uebung>`-Block: fünf Aufgaben quer durch Schrift, Partikel, Verbform, Zählwort und Höflichkeit, mit Lösungen. Verweis: Grammatik-Lektion 12. |

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npm test -- skills/japanese/lessons`
Expected: PASS — genau 30 Dateien, `order` 1–30, Kette von `01-aussprache` bis `30-hoeflichkeit`.

- [ ] **Step 5: Check the course in the running app**

Run: `npm run dev`, dann `http://localhost:5173/skill/japanese/kurs` öffnen.
Expected: Die Lektionsliste zeigt 30 Einträge, nur die erste ist freigeschaltet, die MDX-Bausteine rendern farbig. Danach den Server wieder stoppen.

- [ ] **Step 6: Document it**

In `README.md` unter „Mitgelieferte Lernbereiche" den Japanisch-Satz um den Kurs erweitern: „`skills/japanese` (30-Lektionen-Kurs, Kana, Vokabeln, Grammatik, Lesen)".

In `PROJECT_LOG.md` einen Abschnitt „Abweichungen vom Plan (Akkord-Editor und Japanisch-Kurs)" mit den tatsächlich aufgetretenen Abweichungen ergänzen sowie im Entscheidungsprotokoll zwei Zeilen:

```markdown
- 2026-08-07 — Griffbild-Overrides liegen in SQLite, nicht in `chords/*.json`: der Vite-Glob liest
  die Dateien zur Buildzeit, und ein songbezogener Geltungsbereich hat im Dateiformat keine Entsprechung.
- 2026-08-07 — Der Japanisch-Kurs verweist auf das Grammatikmodul, statt es zu ersetzen: der Kurs ist
  der rote Faden, das Grammatikmodul bleibt Nachschlagewerk.
```

- [ ] **Step 7: Run everything**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: alles grün.

- [ ] **Step 8: Commit**

```bash
git add skills/japanese/lessons README.md PROJECT_LOG.md
git commit -m "feat(japanese): complete the beginners course with the everyday block"
```
