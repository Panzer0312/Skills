# Guitar RPG Stage 1: Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the guitar area into a playable daily routine: full-screen village, status bar, first-launch placement, adaptive daily quests with real minute tracking, and the Chord Change Trainer, with all existing tools reachable inside the game.

**Architecture:** Pure game rules live in `packages/core/src/game` with unit tests. The server stores raw practice entries in SQLite and derives XP, level and streak on read. The game is one fullscreen skill widget with nested routes under `skills/guitar/`, reached through a small generic core addition (`fullscreen` and `redirect` in the manifest).

**Tech Stack:** TypeScript, React 18, React Router 6, TanStack Query, Tailwind 3, Hono, better-sqlite3, zod, Vitest, Testing Library, Playwright, Python with Pillow for the one-off sprite cut.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md`

**Scope:** Stage 1 of 5. Stages 2 to 5 get their own plans once this code exists. See "Later stages" at the end, which assigns every remaining spec item.

## Global Constraints

- All instructions, tips, buttons and story text in German. Names of regions and titles may stay English.
- Nothing is hard-locked: lessons and tools are always reachable. First launch gates only the village and quest screens.
- Rewards follow practice time and honest answers. No penalties beyond the streak counter.
- No commercial tabs or lyrics shipped.
- Game state in SQLite, not localStorage. Local day logic, as in `packages/server/src/routes/stats.ts`.
- Pixel fonts load locally, never from a CDN.
- No audio from the game itself during quests, except metronome and trainer signals.
- Japanese, demo, review and Anki features stay unchanged.
- Work on `master`, as this repo always has (a worktree costs a native `better-sqlite3` rebuild).
- Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A timer left running for hours must not grant hours of practice: the result dialog shows editable minutes, prefilled and capped at 3 times the planned time.
- Practising across midnight or a clock change must not break the streak: days are walked by calendar, not by adding 86,400,000 ms.
- The server being down when a quest ends must not lose the result: the dialog stays open with the German error and allows retry.
- A brand-new player, a player with no target song, and a player who finished the whole road must each get a valid quest board, never an empty or crashing one.
- A double click on save, or a reload mid-quest, must not double XP or lose elapsed time and must not reshuffle today's quests.

---

## File Structure

```
packages/core/src/game/
  time.ts          localDayKey, weekStartKey, previousDay
  progression.ts   xpForEntry, levelFromXp, titleForLevel, computeStreak
  difficulty.ts    suggestLevel, scaleQuest, isMastered
  quests.ts        content schema, parseGameContent, bestNext, buildDailyQuests
  index.ts
packages/server/src/routes/game.ts     all /api/game routes
skills/guitar/game/
  quests.json, road.json               content
  content.test.ts
  api.ts                               typed client and useGameState
  assets.ts                            sprite URLs
  game.css                             fonts, tokens
  GameShell.tsx, StatusBar.tsx, Village.tsx, QuestBoard.tsx, QuestView.tsx,
  ResultDialog.tsx, ChordTrainer.tsx, Placement.tsx, Places.tsx
skills/guitar/assets/                  cut sprites, committed
skills/guitar/widgets/GameApp.tsx      fullscreen widget entry
scripts/cut-sprites.py
```

---

### Task 1: Manifest additions and fullscreen route

**Files:**
- Modify: `packages/core/src/schema/manifest.ts`, `packages/core/src/schema/manifest.test.ts`
- Modify: `packages/web/src/skills/ModuleRoute.tsx`, `packages/web/src/skills/ModuleRoute.test.tsx`, `packages/web/src/skills/SkillOverview.tsx`, `packages/web/src/app/router.tsx`
- Modify: `.gitignore`

**Interfaces:**
- Produces: module fields `fullscreen: boolean` (default false), `redirect?: string`; manifest field `entry?: string`. Route `/vollbild/:skillId/:moduleId/*` renders a module's widget without `Layout`. Exported `FullscreenModuleRoute` in `ModuleRoute.tsx`.

- [ ] **Step 1: Write the failing tests**

In `manifest.test.ts`:
```ts
it("defaults fullscreen to false and keeps redirect and entry", () => {
  const result = parseManifest({
    ...valid,
    entry: "/vollbild/demo/cards",
    modules: [{ id: "cards", type: "practice", title: "K", redirect: "/x", data: [] }],
  });
  expect(result.ok).toBe(true);
  if (result.ok) {
    expect(result.manifest.entry).toBe("/vollbild/demo/cards");
    expect(result.manifest.modules[0]?.fullscreen).toBe(false);
    expect(result.manifest.modules[0]?.redirect).toBe("/x");
  }
});
```
In `ModuleRoute.test.tsx`, following its existing mocks: a module with `redirect: "/ziel"` navigates to `/ziel`; `FullscreenModuleRoute` renders the widget of a module with `fullscreen: true` and shows "Dieses Modul existiert nicht." for one without it.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/schema packages/web/src/skills/ModuleRoute`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

Add the schema fields. In `ModuleRoute`, return `<Navigate to={module.redirect} replace />` first when `redirect` is set. In `SkillOverview`, return `<Navigate to={skill.manifest.entry} replace />` when `entry` is set. Extract the widget rendering so `FullscreenModuleRoute` shares it, and add `{ path: "/vollbild/:skillId/:moduleId/*", element: <FullscreenModuleRoute /> }` as a top-level route outside `Layout`.

Add `.superpowers/` to `.gitignore`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/schema packages/web/src/skills && npm run typecheck`
Expected: PASS, no type errors.

- [ ] **Step 5: Commit**

```bash
git add packages .gitignore
git commit -m "feat(skills): add fullscreen modules and manifest redirects"
```

---

### Task 2: Time and progression rules

**Files:**
- Create: `packages/core/src/game/time.ts`, `packages/core/src/game/progression.ts`, `packages/core/src/game/progression.test.ts`, `packages/core/src/game/index.ts`
- Modify: `packages/core/src/index.ts`, `packages/server/src/routes/stats.ts` (use `localDayKey` instead of its private `dayKey`)

**Interfaces:**
- Produces:
  - `localDayKey(ts: number): string` as `YYYY-MM-DD`
  - `previousDay(day: string): string`
  - `weekStartKey(day: string): string`, the Monday of that week
  - `type Rating = "zu-leicht" | "passt" | "zu-schwer"`
  - `interface PracticeEntry { kind: "quest" | "frei"; seconds: number; level: number; rating: Rating | null }`
  - `xpForEntry(entry: PracticeEntry): number`
  - `levelFromXp(xp: number): { level: number; xpIntoLevel: number; xpForNext: number }`
  - `titleForLevel(level: number): string`
  - `computeStreak(days: string[], today: string): number`

Values: `xpForEntry` is `round(seconds / 60 * 4 * (1 + (level - 1) * 0.1))`, plus 10 for a rated quest of at least 30 seconds. Free play counts as level 1. Reaching level `n + 1` from `n` costs `100 * n` XP. Titles change every 3 levels, from this list, and the last one stays: `Wandering Novice`, `Squire of the Strings`, `Journeyman of the Frets`, `Knight of the Riff`, `Master of the Road`, `Legend of the Six Strings`.

- [ ] **Step 1: Write the failing tests**

```ts
describe("xpForEntry", () => {
  it("pays by real time and level", () => {
    expect(xpForEntry({ kind: "frei", seconds: 600, level: 1, rating: null })).toBe(40);
    expect(xpForEntry({ kind: "quest", seconds: 300, level: 6, rating: "passt" })).toBe(40);
  });
  it("gives nothing for no practice", () => {
    expect(xpForEntry({ kind: "quest", seconds: 0, level: 10, rating: "passt" })).toBe(0);
  });
});
describe("levelFromXp", () => {
  it("starts at level 1", () => expect(levelFromXp(0)).toEqual({ level: 1, xpIntoLevel: 0, xpForNext: 100 }));
  it("crosses a level exactly", () => expect(levelFromXp(300)).toEqual({ level: 3, xpIntoLevel: 0, xpForNext: 300 }));
});
describe("titleForLevel", () => {
  it("steps every three levels", () => {
    expect(titleForLevel(3)).toBe("Wandering Novice");
    expect(titleForLevel(4)).toBe("Squire of the Strings");
    expect(titleForLevel(99)).toBe("Legend of the Six Strings");
  });
});
describe("computeStreak", () => {
  it("is zero without practice", () => expect(computeStreak([], "2026-11-04")).toBe(0));
  it("does not break because today is still open", () => {
    expect(computeStreak(["2026-11-02", "2026-11-03"], "2026-11-04")).toBe(2);
  });
  it("forgives one missed day per calendar week", () => {
    expect(computeStreak(["2026-11-02", "2026-11-04"], "2026-11-04")).toBe(2);
  });
  it("breaks on a second miss in one week", () => {
    expect(computeStreak(["2026-11-02", "2026-11-05", "2026-11-06"], "2026-11-06")).toBe(2);
  });
  it("survives the clock change", () => {
    expect(computeStreak(["2026-10-24", "2026-10-25", "2026-10-26"], "2026-10-26")).toBe(3);
  });
});
```
`2026-11-02` is a Monday. `computeStreak` counts practised days only. Forgiven days add nothing. Today being unpractised uses no forgiveness.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/core/src/game`
Expected: FAIL, module not found.

- [ ] **Step 3: Implement the signatures above**

Do date arithmetic on `new Date(y, m - 1, d)` with `setDate`, never by milliseconds. Export through `game/index.ts` and `packages/core/src/index.ts`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core packages/server/src/routes/stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages
git commit -m "feat(core): add XP, level and forgiving streak rules"
```

---

### Task 3: Difficulty, quest content and daily quest selection

**Files:**
- Create: `packages/core/src/game/difficulty.ts`, `packages/core/src/game/difficulty.test.ts`, `packages/core/src/game/quests.ts`, `packages/core/src/game/quests.test.ts`
- Create: `skills/guitar/game/quests.json`, `skills/guitar/game/road.json`, `skills/guitar/game/content.test.ts`

**Interfaces:**
- Consumes: `Rating` from Task 2.
- Produces:
```ts
interface QuestScale { bpm?: [number, number]; tempoPercent?: [number, number]; chordPairs?: [string, string][] }
interface QuestDefinition {
  id: string; title: string; description: string;
  kind: "wechsel" | "technik" | "song" | "theorie" | "aufwaermen";
  techniqueId: string; lessonId: string | null; minutes: number; icon: string;
  metricLabel?: string; masteryTarget?: number; scale: QuestScale;
}
interface Technique { id: string; title: string }
interface RoadStep { lessonId: string; questId: string; months: [number, number]; reason: string }
interface GameContent { techniques: Technique[]; quests: QuestDefinition[]; road: RoadStep[] }
type LessonStatus = "offen" | "aktiv" | "gelernt" | "gemeistert";
interface ScaledQuest { bpm: number | null; tempoPercent: number | null; chordPair: [string, string] | null }

parseGameContent(input: unknown): GameContent           // zod; throws a German message
scaleQuest(quest: QuestDefinition, level: number): ScaledQuest
suggestLevel(ratings: { rating: Rating; level: number }[], current: number): number | null
isMastered(entries: { rating: Rating | null; day: string; metricValue: number | null }[], target?: number): boolean
bestNext(road: RoadStep[], statuses: Record<string, LessonStatus>): RoadStep | null
buildDailyQuests(input: {
  minutes: number; content: GameContent; statuses: Record<string, LessonStatus>;
  hasTargetSong: boolean; recentQuestIds: string[];
}): string[]
```

Rules:
- `scaleQuest`: linear from level 1 to 10, rounded. `chordPair` picks `chordPairs[floor((level - 1) / 10 * length)]`.
- `suggestLevel`: `ratings` are newest first. Only entries at the current level count. One "zu-schwer" as newest gives `current - 1` (floor 1). The two newest both "zu-leicht" gives `current + 1` (ceiling 10). Otherwise null.
- `isMastered`: with a target, any `metricValue >= target`. Without one, "passt" or "zu-leicht" on 3 different days.
- `bestNext`: first road step whose lesson is `offen`, `aktiv` or missing. Null at the end of the road.
- `buildDailyQuests` priority: best-next quest, change drill (kind `wechsel`), song quest (only if `hasTargetSong`), theory, warm-up, then any other quest not in `recentQuestIds`. Take in that order while the sum fits `minutes`. Always return at least the first candidate, even if it exceeds `minutes`. With the road finished, the change drill leads. No duplicates. Deterministic, no randomness.

Content in `quests.json`, German: techniques `akkordwechsel`, `anschlag`, `rhythmus`, `powerchords`, `barre`, `lead`, `theorie`, `song`. At least one quest for each of the 13 lessons, plus `song-ziel` (kind `song`, 10 minutes, `tempoPercent: [50, 100]`, lessonId null), and `wechsel-minute` (kind `wechsel`, 5 minutes, lessonId `07-akkordwechsel`, metric label "Wechsel pro Minute", `masteryTarget: 40`, `chordPairs` in the order of lesson 07: Em-Am, Am-C, C-G, G-D, D-Am). Take BPM ranges from each lesson's `<Uebung bpm>` as the middle of the range.

`road.json`: the 13 existing lessons in the order 01 to 13 with months spread over 1 to 6 and a German `reason` each. Stage 2 extends it.

- [ ] **Step 1: Write the failing tests**

```ts
describe("suggestLevel", () => {
  const at = (rating: Rating, level = 4) => ({ rating, level });
  it("lowers after one too hard", () => expect(suggestLevel([at("zu-schwer")], 4)).toBe(3));
  it("raises after two too easy", () => expect(suggestLevel([at("zu-leicht"), at("zu-leicht")], 4)).toBe(5));
  it("needs two in a row", () => expect(suggestLevel([at("zu-leicht"), at("passt")], 4)).toBeNull());
  it("ignores results from another level", () => {
    expect(suggestLevel([at("zu-leicht", 4), at("zu-leicht", 3)], 4)).toBeNull();
  });
  it("stays within 1 to 10", () => {
    expect(suggestLevel([at("zu-schwer", 1)], 1)).toBeNull();
    expect(suggestLevel([at("zu-leicht", 10), at("zu-leicht", 10)], 10)).toBeNull();
  });
});
describe("isMastered", () => {
  it("uses the target when there is one", () => {
    expect(isMastered([{ rating: "passt", day: "2026-11-01", metricValue: 40 }], 40)).toBe(true);
  });
  it("needs three different days otherwise", () => {
    const e = (day: string) => ({ rating: "passt" as const, day, metricValue: null });
    expect(isMastered([e("2026-11-01"), e("2026-11-01"), e("2026-11-02")])).toBe(false);
    expect(isMastered([e("2026-11-01"), e("2026-11-02"), e("2026-11-03")])).toBe(true);
  });
});
describe("buildDailyQuests", () => {
  // fixture: road a->b; quests a(10), b(10), wechsel(5), song(10), theorie(5), warm(5)
  it("fills 30 minutes in priority order", () => {
    expect(build({ minutes: 30 })).toEqual(["a", "wechsel", "song", "theorie"]);
  });
  it("skips the song quest without a target song", () => {
    expect(build({ minutes: 30, hasTargetSong: false })).toEqual(["a", "wechsel", "theorie", "warm"]);
  });
  it("trims to the most important item for a short session", () => {
    expect(build({ minutes: 10 })).toEqual(["a"]);
  });
  it("never returns an empty board", () => expect(build({ minutes: 1 })).toEqual(["a"]));
  it("leads with the change drill once the road is finished", () => {
    expect(build({ statuses: { a: "gelernt", b: "gelernt" }, minutes: 5 })).toEqual(["wechsel"]);
  });
});
```
`content.test.ts` runs `parseGameContent`, then asserts: every `lessonId` is an existing `.mdx` file, every road `questId` exists, ids are unique, every lesson 01 to 13 is on the road, and every `techniqueId` is defined.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/game skills/guitar/game`
Expected: FAIL.

- [ ] **Step 3: Implement the rules and write both JSON files**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/core/src/game skills/guitar/game`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages skills
git commit -m "feat(guitar): add difficulty rules, quest content and daily selection"
```

---

### Task 4: Game API

**Files:**
- Create: `packages/server/src/routes/game.ts`, `packages/server/src/routes/game.test.ts`
- Modify: `packages/server/src/db/client.ts` (DDL), `packages/server/src/app.ts` (register route)

**Interfaces:**
- Consumes: Tasks 2 and 3.
- Produces tables:
```sql
CREATE TABLE IF NOT EXISTS game_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT, skill_id TEXT NOT NULL, day TEXT NOT NULL, at INTEGER NOT NULL,
  kind TEXT NOT NULL, quest_id TEXT, lesson_id TEXT, technique_id TEXT, seconds INTEGER NOT NULL,
  level INTEGER NOT NULL, rating TEXT, metric_key TEXT, metric_value REAL
);
CREATE INDEX IF NOT EXISTS game_log_by_skill ON game_log (skill_id, day);
CREATE TABLE IF NOT EXISTS game_levels (skill_id TEXT NOT NULL, technique_id TEXT NOT NULL, level INTEGER NOT NULL, PRIMARY KEY (skill_id, technique_id));
CREATE TABLE IF NOT EXISTS game_today (skill_id TEXT NOT NULL, day TEXT NOT NULL, minutes INTEGER NOT NULL, quest_ids_json TEXT NOT NULL, PRIMARY KEY (skill_id, day));
CREATE TABLE IF NOT EXISTS game_profile (skill_id TEXT PRIMARY KEY, placed_at INTEGER, target_song_id TEXT);
```
- Produces routes, all under `/api/game/:skillId`:

| Route | Body | Result |
|---|---|---|
| `GET /state` | none | `GameState` below |
| `POST /log` | `LogBody` | `{ xpGained, suggestion: number \| null, isRecord: boolean }` |
| `PUT /level/:techniqueId` | `{ level }` 1 to 10 | `{ ok: true }` |
| `PUT /lesson/:lessonId` | `{ status }` | `{ ok: true }` |
| `PUT /today` | `{ minutes, questIds }` | `{ ok: true }` |
| `POST /placement` | `{ knownLessonIds, levels, targetSongId }` | `{ ok: true }` |

```ts
interface GameState {
  placed: boolean; targetSongId: string | null;
  xp: number; level: number; title: string; xpIntoLevel: number; xpForNext: number;
  streak: number; totalSeconds: number; weekSeconds: number; doneToday: string[];
  levels: Record<string, number>; lessons: Record<string, LessonStatus>;
  records: Record<string, number>; recentQuestIds: string[];
  today: { minutes: number; questIds: string[] } | null;
}
interface LogBody {
  kind: "quest" | "frei"; questId?: string; lessonId?: string; techniqueId?: string;
  seconds: number; level: number; rating?: Rating; metricKey?: string; metricValue?: number;
  masteryTarget?: number;
}
```
- Lesson status lives in the existing `lesson_progress` table. Read mapping: `done` becomes `gelernt`, `active` becomes `aktiv`, `open` becomes `offen`, and `aktiv`, `gelernt`, `gemeistert` stay. This carries over old course progress with no migration.
- `POST /log`: `seconds` must be 0 to 14400. It moves an `offen` lesson to `aktiv`, and upgrades to `gemeistert` when `isMastered` holds. It never downgrades. `suggestion` comes from `suggestLevel` over that technique's entries. `isRecord` is true when `metricValue` beats the previous maximum for `metricKey`.
- `targetSongId` is a string: `uebung:<id>` or `db:<id>`.
- `recentQuestIds`: distinct quest ids from yesterday's log.
- `doneToday`: quest ids logged today.
- `POST /placement` may run repeatedly and must not lower `gemeistert`.

- [ ] **Step 1: Write the failing tests**

Using the setup of `stats.test.ts` (`openDatabase(":memory:")`, `app.request`), cover:
```ts
it("reports a clean state for a new player");          // placed false, level 1, streak 0, today null, title "Wandering Novice"
it("adds logged time and XP to the state");            // 600 s free => totalSeconds 600, xp 40
it("derives XP from entries, not a stored total");     // direct INSERT into game_log shows up in xp
it("suggests a higher level after two too-easy results");
it("marks a new metric record once");                  // 20 => true, 18 => false, 22 => true
it("moves a lesson to aktiv, then gemeistert at the target");
it("never downgrades a mastered lesson");
it("treats old course progress as gelernt");           // PUT /api/progress/guitar/01-haltung done
it("keeps today's quests stable across reads");
it("rejects a level of 11 and negative seconds with 400 invalid_body");
it("rejects a log of more than four hours");
it("keeps skills apart");                              // log for guitar invisible under demo
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/server/src/routes/game`
Expected: FAIL.

- [ ] **Step 3: Implement**

Follow `progress.ts` for zod errors (`invalid_body`, status 400) and for `c.get("database").raw`. Compute `day` with `localDayKey(Date.now())`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/server`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/server
git commit -m "feat(server): add game state, practice log and placement API"
```

---

### Task 5: Sprite pipeline and game look

**Files:**
- Create: `scripts/cut-sprites.py`, `skills/guitar/assets/*.png`, `skills/guitar/assets/CREDITS.md`, `skills/guitar/game/assets.ts`, `skills/guitar/game/assets.test.ts`, `skills/guitar/game/game.css`
- Modify: `packages/web/package.json` (add `@fontsource/pixelify-sans`, `@fontsource/jersey-15`, both OFL-1.1)
- Add to git: `sprites/`

**Interfaces:**
- Produces: `spriteUrl(name: SpriteName): string`, and `SpriteName` listing: `sword potion key ruby shield bow scroll gold helm mana ring chest parchment firebag torch goldbag emblem oak birch pine pine2 mushroom log stump village`.
- `game.css` defines tokens on `.game-root`: `--ink #2b1d12`, `--parch #ecd9b0`, `--parch2 #dcc392`, `--wood #3a2414`, `--wood2 #1c1009`, `--gold #e8b23a`, plus `.game-root img { image-rendering: pixelated }`. Body font `Jersey 15`, headings `Pixelify Sans`.

- [ ] **Step 1: Write the failing test**

`assets.test.ts`: every `SpriteName` resolves to a defined URL. Also read each PNG's size from disk and assert the image width is at least 30, and for `village`, that width is 1130 and height 760.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/assets`
Expected: FAIL.

- [ ] **Step 3: Write `scripts/cut-sprites.py`**

Crop boxes per sheet. Sheet `items_spritesheet.png`, 3 rows of 4: `sword (62,78,244,272)`, `potion (302,78,486,272)`, `key (538,78,722,272)`, `ruby (778,78,962,272)`, `shield (62,415,244,610)`, `bow (302,415,486,610)`, `scroll (538,415,722,610)`, `gold (778,415,962,610)`, `helm (62,762,244,958)`, `mana (302,762,486,958)`, `ring (538,762,722,958)`. Sheet `items2_spritesheet.webp`: `chest (425,140,525,235)`, `parchment (910,585,1024,695)`, `firebag (790,470,885,572)`, `torch (555,578,630,695)`, `goldbag (5,800,95,908)`, `emblem (555,470,642,570)`. Sheet `forest_spritesheet.png`, tolerance 30: `oak (5,5,140,195)`, `birch (520,5,612,195)`, `pine (715,5,812,195)`, `pine2 (918,5,1018,195)`, `mushroom (318,835,398,908)`, `log (515,835,612,912)`, `stump (725,835,812,912)`. Other sheets use tolerance 38.

Method: flood-fill from the 4 corners and 4 edge midpoints with Pillow's `ImageDraw.floodfill`, turn the filled colour transparent, trim to bounding box. Village: crop `(0,0,1130,760)`, which removes the watermark. The boots cell is excluded because the watermark overlaps it.

Run: `python3 -I scripts/cut-sprites.py sprites skills/guitar/assets`. Look at the output. Fix any sprite that lost edges, as the oak did with a narrower box.

- [ ] **Step 4: Implement `assets.ts` and `game.css`, then install fonts**

`assets.ts` uses `import.meta.glob("../assets/*.png", { eager: true, query: "?url", import: "default" })`. Run `npm install -w @skills/web @fontsource/pixelify-sans @fontsource/jersey-15`. `CREDITS.md` states the sprites are supplied by the owner and names both fonts with their license.

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run skills/guitar/game/assets && npm run build`
Expected: PASS, build succeeds.

- [ ] **Step 6: Commit**

```bash
git add scripts sprites skills packages/web/package.json package-lock.json
git commit -m "feat(guitar): add clean sprite assets and game look"
```

---

### Task 6: Game shell, status bar, village, and tools inside the game

**Files:**
- Create: `skills/guitar/widgets/GameApp.tsx`, `skills/guitar/game/api.ts`, `skills/guitar/game/GameShell.tsx`, `skills/guitar/game/StatusBar.tsx`, `skills/guitar/game/Village.tsx`, `skills/guitar/game/Places.tsx`, `skills/guitar/game/GameShell.test.tsx`
- Modify: `skills/guitar/skill.json`, `packages/web/src/renderers/CourseRenderer.tsx`, `packages/web/src/features/songs/SongImport.tsx` if the redirect does not cover it
- Delete: `skills/guitar/widgets/PracticePlan.tsx`, `skills/guitar/widgets/PracticePlan.test.tsx`, `skills/guitar/practice/plan.json`
- Modify: `e2e/guitar.spec.ts`

**Interfaces:**
- Consumes: Task 1 routes, Task 4 API, Task 5 assets.
- Produces in `api.ts`: `useGameState(): UseQueryResult<GameState>`, plus `gameApi.log(body)`, `gameApi.setLevel(id, level)`, `gameApi.setToday(minutes, ids)`, `gameApi.placement(body)`. All use skill id `guitar`, and invalidate query key `["game", "guitar"]`. Also `gameContent: GameContent`, parsed once from the JSON files.
- Game routes, relative to `/vollbild/guitar/spiel`: index village, `quests`, `quest/:questId`, `einstufung`, `taverne`, `bibliothek`, `bibliothek/:lessonId`, `hafen`, `markt`, `schrein`, `schmiede`, `griffbrett`, `chronik`.
- `CourseRenderer` gains props `ignoreLocks?: boolean` and `initialLessonId?: string`.

`skill.json`: add `"entry": "/vollbild/guitar/spiel"` and module `{ "id": "spiel", "type": "practice", "title": "Spiel", "fullscreen": true, "widget": "GameApp", "data": ["songs/uebungsstuecke.json"] }`. Replace the old modules' routing with `redirect`, keeping `pinned` on the tuner: `kurs` to `/bibliothek`, `stimmgeraet` to `/schrein`, `griffbrett` to `/griffbrett`, `akkorde` to `/schmiede`, `uebungsplan` to `/quests`, `songs` to `/taverne`, `nice-to-know` to `/bibliothek`, each prefixed by `/vollbild/guitar/spiel`. Set `uebungsplan`'s `data` to `[]`, because `plan.json` is deleted and a missing manifest file marks the whole skill broken.

Screens:
- `StatusBar`: level and title, XP bar, streak, "gesamt" time, "diese Woche" time, link back to the village. Format time as `38h 20m`.
- `Village`: `village` image with these links as absolutely placed, percent-based signs: Quest Board, Tavern, Library, Harbor, Market. Beside it the today panel with the day's quests, one click each. Below it a compact menu: Shrine, Forge, Griffbrett, Chronicle. Below 640 px wide, the painting is hidden and the same links show as a list, today's quests first.
- `Places.tsx`: each place is a `ToolFrame` with German heading and wood border, inner `bg-white dark:bg-slate-950`, so old widgets work with either app theme. Tavern renders `SongLibrary` and a link to `/songs/neu`. Library renders `CourseRenderer` with `ignoreLocks` for `lessons`, and for `reference`. Shrine renders `Tuner`. Griffbrett renders `Fretboard`. Forge renders `ChordDiagram` and, from Task 8, the trainer. Harbor lists `gameContent.road` with status and the best next step highlighted, and says "Die Karte öffnet bald". Market says "Der Markt öffnet bald". Chronicle shows total time, week, streak, level and records, plus a link "Einstufung wiederholen".
- `GameShell` redirects index and `quests` to `einstufung` while `placed` is false. Tool places never redirect.

- [ ] **Step 1: Write the failing tests**

In `GameShell.test.tsx`, with a mocked `fetch` returning `GameState`:
```tsx
it("sends an unplaced player to the placement from the village");
it("lets an unplaced player open the tuner");
it("shows level, title, streak and time in the status bar");   // "2h 15m" for 8100 s
it("offers all five village places as links");
it("starts today's quest with one click from the village");
it("shows an error with retry when the server is down");
```
Add to `CourseRenderer`'s test or a new one: `ignoreLocks` makes a locked lesson clickable.

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/GameShell`
Expected: FAIL.

- [ ] **Step 3: Implement the screens**

`GameApp` imports `game.css` and wraps nested `<Routes>` in `.game-root`. It passes `data` and `progress` from its `WidgetProps` to embedded widgets. `QuestBoard`, `QuestView` and `Placement` are temporary stubs here, replaced in Tasks 7 to 9.

- [ ] **Step 4: Update `e2e/guitar.spec.ts`**

Keep the old URLs, which now redirect. Fix any selector that changed. Replace nothing else.

- [ ] **Step 5: Verify**

Run: `npm test && npm run typecheck && npm run test:e2e`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add -A skills packages e2e
git commit -m "feat(guitar): move the guitar area into a village game shell"
```

---

### Task 7: Placement

**Files:**
- Create: `skills/guitar/game/Placement.tsx`, `skills/guitar/game/Placement.test.tsx`

**Interfaces:**
- Consumes: `gameContent`, `gameApi.placement`, `GET /api/songs`, bundled songs from `data`.

Three short steps, German:
1. "Was kannst du schon?": checkboxes for the 13 lessons.
2. "Wie sicher fühlst du dich?": slider 1 to 10 per technique, default 3.
3. "Welchen Song willst du als Nächstes schaffen?": imported and bundled songs, or "Noch keinen". Imported songs first. If a title contains "Bard", preselect it.

On finishing, go to the Quest Board. Re-running preloads current values.

- [ ] **Step 1: Write the failing test**

```tsx
it("posts known lessons, levels and target song");
it("works with no songs at all");     // "Noch keinen" gives targetSongId null
it("preselects The Bard's Song when it is imported");
it("keeps the dialog and shows the error when saving fails");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/Placement`
Expected: FAIL.

- [ ] **Step 3: Implement `Placement`**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run skills/guitar/game/Placement`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): add first-launch placement"
```

---

### Task 8: Chord Change Trainer

**Files:**
- Create: `skills/guitar/game/ChordTrainer.tsx`, `skills/guitar/game/ChordTrainer.test.tsx`, `packages/web/src/audio/signalTone.ts`
- Modify: `skills/guitar/game/Places.tsx` (Forge)

**Interfaces:**
- Consumes: `ChordDiagramSingle`, `useChordOverrides`, `gameApi.log`, `state.records`.
- Produces: `<ChordTrainer pair?: [string, string]; onResult?: (changes: number) => void />`, `playSignal(kind: "start" | "ende"): void`.

Flow: pick a pair, press start, a 3-second count-in with signal, 60-second countdown with both diagrams large, end signal, then a number input "Wie viele saubere Wechsel?". Metric key `wechsel:<A>-<B>`, pairs normalised alphabetically so Am-Em equals Em-Am. Shows personal record and "Neuer Rekord!" when `isRecord`.

Without `onResult` (Forge) it logs itself as `kind: "frei"`, `seconds: 60`, with the metric. With `onResult` (in a quest) it hands over the number and logs nothing.

- [ ] **Step 1: Write the failing test**

With fake timers:
```tsx
it("counts in, runs 60 seconds and asks for the count");
it("logs a free result with a normalised metric key");   // Am, Em => "wechsel:Am-Em"
it("shows the personal record for the chosen pair");
it("celebrates a new record");
it("hands the number to onResult in a quest and logs nothing");
it("rejects a negative or empty count");
it("can be cancelled without logging");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/ChordTrainer`
Expected: FAIL.

- [ ] **Step 3: Implement**

Base `playSignal` on `referenceTone.ts`, with short beeps of 880 Hz for start and 440 Hz for end. Use a deadline from `Date.now()` for the countdown, so it stays right in background tabs.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run skills/guitar/game/ChordTrainer`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills packages/web/src/audio
git commit -m "feat(guitar): add the chord change trainer"
```

---

### Task 9: Quest Board, quest view and result loop

**Files:**
- Create: `skills/guitar/game/QuestBoard.tsx`, `skills/guitar/game/QuestView.tsx`, `skills/guitar/game/ResultDialog.tsx`, `skills/guitar/game/QuestLoop.test.tsx`

**Interfaces:**
- Consumes: `buildDailyQuests`, `bestNext`, `scaleQuest`, `gameApi`, `useMetronome`, `ChordTrainer`.

**Quest Board:** session length buttons 10, 20, 30, 45, default 30. On first open of the day it builds the set and saves with `setToday`. Changing the length rebuilds it. A saved set is otherwise never rebuilt. Each row: sprite, title, minutes, personal level as 10 dots, done mark from `doneToday`. Rows can be removed, and a "Quest tauschen" list offers the other quests. Above the list: best next step with its German `reason`.

**Quest view:** title, description, scaled values, link "Lektion lesen" to `bibliothek/:lessonId`, an elapsed timer, metronome with start, stop, BPM and tap, preset from `scaleQuest`. Kind `wechsel` embeds `ChordTrainer` with the scaled pair. Kind `song` shows the target song title, a link to the Tavern, and the tempo percentage, or, without a target song, a link to `einstufung`.

Timer: store `{ questId, startedAt }` in `sessionStorage` under `game.activeQuest`, so a reload resumes. Elapsed is computed from `Date.now()`.

**Result dialog** after "Fertig": three buttons "Zu leicht", "Passt", "Zu schwer". Number field where `metricLabel` exists, prefilled by the trainer. Editable "Geübte Minuten", prefilled with elapsed minutes, capped at 3 times the quest's minutes. Save calls `gameApi.log` with `masteryTarget` and `metricKey` (`quest.id`, or the trainer's key). The button disables while saving. On failure it shows the error and stays open. After success: XP gained, then if `suggestion` is not null, "Nächstes Mal Stufe X?" with a 1 to 10 slider preset to it and a confirm button, calling `setLevel`. Then back to the board.

The board also lets the owner change a quest's level directly with the same slider.

- [ ] **Step 1: Write the failing tests**

```tsx
it("builds and saves today's set once");                    // one PUT /today
it("does not rebuild a saved set on reload");
it("rebuilds when the session length changes");
it("shows the best next step with its reason");
it("scales the quest with the personal level");             // level 10 shows top BPM
it("resumes the timer after a reload");
it("caps prefilled minutes at three times the plan");
it("logs edited minutes, not the timer value");
it("sends one log on a double click");
it("keeps the dialog open and retries after a server error");
it("offers the suggested level and saves the owner's choice");
it("saves nothing when the owner declines the suggestion");
it("offers a link to the placement for a song quest without a song");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/QuestLoop`
Expected: FAIL.

- [ ] **Step 3: Implement the three components and remove the Task 6 stubs**

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run skills/guitar/game`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): add daily quests with adaptive difficulty"
```

---

### Task 10: End-to-end routine and project log

**Files:**
- Create: `e2e/guitar-game.spec.ts`
- Modify: `PROJECT_LOG.md`, `README.md`

- [ ] **Step 1: Write the end-to-end test**

```ts
test("a first session runs from placement to XP in the status bar", async ({ page }) => {
  await page.goto("/skill/guitar");
  await expect(page).toHaveURL(/einstufung/);
  // finish the three placement steps with lesson 01 known
  // Quest Board appears; open the first quest; click Fertig; click Passt; set 5 minutes; save
  // back at the board, the status bar shows XP above 0 and 5m this week
});
test("the tuner stays reachable from the pinned link", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Stimmgerät" }).click();
  await expect(page.getByRole("button", { name: /Stimmgerät starten/ })).toBeVisible();
});
```
`data/e2e.db` persists between runs. Delete it before the run, and make the spec independent of order.

- [ ] **Step 2: Run everything**

Run: `rm -f data/e2e.db* && npm test && npm run typecheck && npm run build && npm run test:e2e`
Expected: all PASS.

- [ ] **Step 3: Check by eye**

Start `npm run dev`, walk the routine at 1400 px and at 390 px wide, and fix what looks broken: sign positions, overflow, unreadable text.

- [ ] **Step 4: Update docs**

`PROJECT_LOG.md`, in German: stage 1 status, and these decisions: XP is derived from `game_log`, lesson status reuses `lesson_progress`, game content lives in JSON beside the lessons. `README.md`: new guitar description.

- [ ] **Step 5: Commit**

```bash
git add e2e PROJECT_LOG.md README.md
git commit -m "test(guitar): cover the first session end to end"
```

---

## Later stages

Each gets its own plan after the previous stage ships.

| Stage | Contents |
|---|---|
| 2 Map and first quarter | skill map with zoom, lesson metadata, lesson panel, navigation pane, Tips Board, gold road, cross-links, Songs for this, active-lesson limit of three, quick wins, target-song lessons, "in Vorbereitung" nodes, all lessons for months 1-3 |
| 3 Tools | metronome accents, subdivisions, speed trainer; fretboard overlays, note-finding game, input picker and level meter; Tavern upgrades; Chronicle graphs; Jam Room; riff viewer; phone layout pass and opt-in home-network start command |
| 4 Lessons and story | remaining lessons up to about 80, each with a visualization, accuracy review, song verification, mentor story |
| 5 Rewards and polish | Market, gear, milestone items, ambience with mute, extra CC0 art with credits |
