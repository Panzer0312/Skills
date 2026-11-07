# Guitar RPG Phase 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the remaining rough edges. Build one typed preferences store with a settings screen, a registry for places and quest tools, an optional-device layer, and a skippable intro.

**Architecture:**
- The server route file `routes/game.ts` (668 lines) is split by feature.
- A typed `PREFS` registry in core, one file per group, drives:
  - a `game_prefs` table,
  - `GET/PUT/DELETE /prefs` routes,
  - a client `usePref` hook,
  - a settings screen that builds itself from the registry.
- `places.ts` and `questTools.ts` registries replace the hard-coded menu, routes and quest tools.
- `useDevices` gates every microphone feature.

**Tech Stack:** TypeScript, React 18, react-router, TanStack Query, Hono + better-sqlite3, zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md` with the amendments in `docs/superpowers/plans/2026-11-07-11-gitarren-naechste-stufe.md` (roadmap, Phase 1).

## Global Constraints

- All UI text German. Use straight quotes, as in the code.
- Anti-goals:
  - no guilt mechanics;
  - no XP for doing nothing;
  - sound must not interfere with practice;
  - no more clicking than playing;
  - no hard walls.
- Devices are optional. A mic feature is hidden or off unless `canUse("mic")`. It needs a full no-device path, and tests use mocks only.
- The default experience equals today's behaviour, except for the rough-edge fixes.
- `localStorage` access goes inside try/catch with fallback. Hooks in `packages/web/src/app/` never import from `skills/`.
- Server schema: new tables only, appended at the end of the schema string in `packages/server/src/db/client.ts` under a comment naming the feature. Columns only through `ensureColumn` (Task 1).
- Prefs registry entries go **only in the group file the task owns** (`packages/core/src/game/prefs/<group>.ts`).
- `npm test` and `npm run typecheck` must be green before commit. Parallel agents share the checkout:
  - commit only your own files with `git add <paths> && git commit -m … -- <paths>`;
  - never use `git add -A`, stash or reset;
  - a failure only in files outside your list belongs to another agent.
- Commit messages end with the attribution line.

## Review Focus

- A stored pref from an older shape, or an unknown key in the DB: it must resolve to the default and never break `/prefs` (Task 1).
- An old localStorage tool setting together with a new pref: migrate once, the pref wins afterwards, and no loop (Task 6).
- The intro shown during the placement redirect: it must not trap the user and must not show twice (Task 10).
- Device "Nein": every mic button is hidden, and the tuner and Note Finder still work by click and reference tone (Task 8).
- Gold after undo with purchases: the wallet is never negative, future gold is not eaten, and the message has no guilt (Task 5).

## Waves (parallel dispatch)

| Wave | Tasks (parallel) | Model hint |
|---|---|---|
| 1 | T1 server split + prefs core (L), T2 trainer/quest keys (M), T3 calendar grid (S), T4 web hook minors (S) | T1 sonnet, T2 sonnet, T3 haiku, T4 haiku |
| 2 | T5 server/free-timer rough edges (M), T6 tool settings → prefs (M), T7 registries (M), T8 device layer (M) | all sonnet |
| 3 | T9 settings screen "Studierstube" (M), T12 device gating + ambience registry switch (S) | sonnet, haiku |
| 4 | T10 intro tour (M) | sonnet |
| 5 | T11 e2e + docs (S) | sonnet |

**File ownership in wave 2** (no overlaps):
- T5: `routes/game/log.ts`, `routes/game/state.ts`, `UndoButton*`, `FreePractice*`, `prefs/ueben.ts`.
- T6: MetronomePanel, JamRoom, Tuner, NoteFinder, ChordTrainer, `sound/*`, `routes/game/settings.ts`, `prefs/klang.ts`, `prefs/werkzeuge.ts`.
- T7: `GameApp.tsx`, `Village.tsx`, `QuestView.tsx`, new `places.ts`, new `questTools.ts`.
- T8: new `skills/guitar/game/devices/*`, `Places.tsx` (Shrine only), `prefs/geraete.ts`.

---

### Task 1: Server split, `ensureColumn`, prefs core and routes, `usePref`

**Files:**
- Split: `packages/server/src/routes/game.ts` → `packages/server/src/routes/game/{index,shared,state,log,lessons,songs,market,settings,prefs}.ts`. `index.ts` exports `gameRoutes`, mounting each sub-router. Every importer of `routes/game.js` keeps working; adjust the import in `app.ts`. Move `packages/server/src/routes/game.test.ts` to `routes/game/game.test.ts` unchanged, except for its import path.
- Split: `skills/guitar/game/api.ts` → keep `api.ts` as the public facade, re-exporting everything it exports today. Move the implementation into `skills/guitar/game/api/{client,state,log,lessons,songs,market,settings,prefs}.ts`.
- Create: `packages/server/src/db/ensureColumn.ts` (+ test), `packages/core/src/game/prefs/{index,types,allgemein,klang,ueben,werkzeuge,geraete,darstellung,mentor,daten}.ts` (+ `prefs.test.ts`), `skills/guitar/game/usePref.ts` (+ test).
- Modify: `packages/server/src/db/client.ts`, appending the `game_prefs` table. Modify `packages/core/src/index.ts` for the exports.

**Interfaces (produces):**
- `ensureColumn(db: Database, table: string, column: string, ddl: string): void` adds the column when it is missing (checked via `PRAGMA table_info`). It is a no-op otherwise.
- Core `prefs/types.ts`:
  ```ts
  export type PrefGroup = "allgemein" | "klang" | "ueben" | "werkzeuge" | "geraete" | "darstellung" | "mentor" | "daten";
  export type PrefUi =
    | { kind: "toggle" }
    | { kind: "select"; options: { value: string; label: string }[] }
    | { kind: "number"; min: number; max: number; step?: number; unit?: string }
    | { kind: "hidden" };
  export interface PrefDef<T> { schema: z.ZodType<T>; default: T; label: string; help?: string; group: PrefGroup; ui: PrefUi }
  ```
- Core `prefs/index.ts`:
  - `export const PREFS = { ...allgemein, ...klang, ...ueben, ...werkzeuge, ...geraete, ...darstellung, ...mentor, ...daten }`;
  - `export type PrefKey = keyof typeof PREFS`;
  - `export type PrefValue<K extends PrefKey> = (typeof PREFS)[K]["default"]`;
  - `export function resolvePrefs(stored: Record<string, unknown>): { [K in PrefKey]: PrefValue<K> }` validates each key, falls back to the default, and drops unknown keys;
  - `export function definePrefs<T extends Record<string, PrefDef<any>>>(defs: T): T` gives group files type safety.
- Each group file exports `definePrefs({...})`. Initial entries:
  - `allgemein.ts`: `"intro.gesehen"`: boolean, default `false`, ui hidden, label "Intro gesehen".
  - All other group files start empty: `definePrefs({})`.
- Table: `CREATE TABLE IF NOT EXISTS game_prefs (skill_id TEXT NOT NULL, key TEXT NOT NULL, value_json TEXT NOT NULL, PRIMARY KEY (skill_id, key));`
- Routes in `routes/game/prefs.ts`:
  - `GET /api/game/:skillId/prefs` → `{ prefs: resolvePrefs(stored) }`;
  - `PUT /api/game/:skillId/prefs` with body `{ key: string, value: unknown }` → 400 `{ error: { code: "unknown_pref" | "invalid_pref", message } }`, else upsert and `{ ok: true }`;
  - `DELETE /api/game/:skillId/prefs` deletes all rows of the skill → `{ ok: true }`;
  - `DELETE /api/game/:skillId/prefs/:key` deletes one → `{ ok: true }`.
- Client:
  - `skills/guitar/game/api/prefs.ts`: `gameApi.prefs()`, `gameApi.setPref(key, value)`, `gameApi.resetPrefs()`, `gameApi.resetPref(key)`, with query key `["game","guitar","prefs"]`.
  - `usePref<K extends PrefKey>(key: K): [PrefValue<K>, (v: PrefValue<K>) => void, { loading: boolean }]` returns the default while loading, updates optimistically, and rolls back with a console-free error on failure.
  - `usePrefs()` returns the whole resolved object.

- [ ] **Step 1:** Pure move of the server routes and the client API. Run the existing tests: all green, with no test changes beyond import paths. Commit `refactor(guitar): split game routes and api by feature`.
- [ ] **Step 2: Failing tests:**
  - `ensureColumn adds a missing column once`;
  - `resolvePrefs drops unknown keys and falls back on invalid values`;
  - `prefs route rejects unknown key`;
  - `prefs route rejects invalid value`;
  - `prefs round trip and reset`;
  - `prefs are scoped by skill`;
  - `usePref returns default while loading and updates optimistically`;
  - `usePref rolls back on failure`.
- [ ] **Step 3:** Implement. **Step 4:** green, typecheck green. **Step 5:** commit `feat(guitar): typed prefs store with routes and usePref`.

### Task 2: Trainer and quest keys, NoteFinder cleanup

**Files:** `skills/guitar/game/ChordTrainer.tsx`, `NoteFinder.tsx`, `QuestView.tsx` + their tests (`ChordTrainer.test.tsx`, `NoteFinder.test.tsx`, `QuestLoop.test.tsx`).

**Interfaces:**
- `ChordTrainer` and `NoteFinder` get the optional prop `onRunningChange?: (running: boolean) => void`. It is called with `true` when a count-in or round starts, and with `false` on end, cancel or unmount.
- QuestView keeps `toolRunning` state:
  - while it is true, `Enter` and `" "` do nothing;
  - `p` opens a confirm `"Laufende Runde abbrechen und pausieren?"` (`window.confirm`) and, if confirmed, cancels the round through a `cancelSignal` prop (a number that increments) and pauses.
  - Both tools accept `cancelSignal?: number` and cancel when it changes.
- NoteFinder cleanup:
  - flatten the nested ternary at the tuning resolution into `fixedTuning !== undefined ? (isTuningName(fixedTuning) ? fixedTuning : "Standard") : storedTuning`;
  - remove the dead `setLevel(0)` calls in `finish()` and `cancel()`.

- [ ] Failing tests:
  - `enter does not finish the quest while a trainer round runs`;
  - `p during a round asks and cancels the round when confirmed`;
  - `p during a round keeps the round when not confirmed`;
  - `onRunningChange reports start and end` (ChordTrainer and NoteFinder each).
- [ ] Implement, green, typecheck, commit `fix(guitar): quest keys respect a running trainer round`.

### Task 3: Calendar grid accessibility

**Files:** `skills/guitar/game/chronicle/DayCalendar.tsx`, `chronicle/Chronicle.test.tsx` (calendar tests only), `chronicle/colors.ts` (only if needed).

**Interfaces:**
- `role="grid"` with `aria-label="Übungstage"`. Rows are weekdays (labels Mo Di Mi Do Fr Sa So, `role="rowheader"`), and columns are weeks with a month label above the first week of each month ("Nov.").
- Cells are `role="gridcell"` with the existing `aria-label` (`3. Nov. 2026: 25 min`). Roving tabindex: only the selected cell has `tabIndex={0}`, and the default selection is today.
- ArrowLeft/Right move ±1 week, ArrowUp/Down move ±1 day, Home/End go to the first/last day.
- The focused cell shows a visible tooltip (the same text) next to it.
- Use a fixed date in the tests (`vi.setSystemTime`).

- [ ] Failing tests:
  - `calendar exposes a grid with weekday headers`;
  - `arrow keys move the focused day`;
  - `focused day shows its tooltip`;
  - `shades 1–14, 15–29 and 30+ differently`.
- [ ] Implement, green, typecheck, commit `fix(guitar): keyboard-friendly practice calendar`.

### Task 4: Web hook minors

**Files:** `packages/web/src/app/useWakeLock.ts`, `usePracticeKeys.ts`, `hooks.test.tsx`; `skills/guitar/game/jam/JamRoom.test.tsx` (tests only).

**Changes:**
- `useWakeLock`: on `visibilitychange` to visible, skip the request if one is pending or a sentinel is held and not released (`sentinel.released === false`).
- `usePracticeKeys`: look up bindings with `Object.hasOwn(current, key)`.
- Tests to add:
  - `visibilitychange re-requests only when no lock is held`;
  - `wake lock releases on unmount`;
  - `practice keys ignore repeat events`;
  - `practice keys call preventDefault when a binding fires`;
  - move the DOM cleanup in the link test into `afterEach`;
  - JamRoom: `box choice survives remount`, `space in a select does not toggle`.

- [ ] Failing tests where behaviour changes (the visibilitychange one). Implement, green, commit `fix(web): wake lock double request, key lookup and missing hook tests`.

### Task 5: Server and free-timer rough edges

**Files:**
- `packages/server/src/routes/game/log.ts`, `routes/game/state.ts` (or wherever `wallet` landed in Task 1), `routes/game/game.test.ts` (new tests in their own `describe`);
- `packages/server/src/db/client.ts` (append the `game_gold_adjust` table);
- `skills/guitar/game/UndoButton.tsx` (+ test), `FreePractice.tsx` (+ test), `skills/guitar/game/api/log.ts`;
- `packages/core/src/game/prefs/ueben.ts`.

**Interfaces:**
- **Gold forgiveness.** Table `game_gold_adjust(skill_id TEXT NOT NULL, at INTEGER NOT NULL, amount INTEGER NOT NULL)`.
  - On `DELETE /log/:id`: compute the wallet before and after. If `earned_after - spent < 0`, insert an adjust row with `amount = -(earned_after - spent)`, so the raw balance becomes 0.
  - `wallet()` adds the sum of the adjust rows.
  - The DELETE response becomes `{ ok: true, goldForgiven: number }`.
- UndoButton: when `goldForgiven > 0`, show `"Eintrag entfernt. Du hattest das Gold schon ausgegeben – es bleibt bei dir, dein Gold steht jetzt auf 0."`
- **Recent since.** `GET /log/recent?since=<ms>` returns all entries with `at >= since`, newest first, capped at 500. Without `since` it behaves as today (20).
  - Client: `gameApi.recentLog(since?: number)`.
  - FreePractice uses `recentLog(timer.startedAt)`.
- **Forgotten-timer confirm.** Pref in `ueben.ts`: `"freiUeben.nachfragenAbMinuten"` (number 15–240, default 90, ui number, unit "min", label "Frei üben: ab wie vielen Minuten nachfragen").
  - On stop, if the remaining minutes are greater than the pref, show a form `"Wie lange hast du wirklich geübt?"` with a minutes input prefilled with the rounded remaining minutes (max 240), plus `Speichern` / `Verwerfen`.
  - Read the pref with `usePref` from Task 1.
- **Export minors.**
  - The export filename uses `${skillId}-export-<day>.json`.
  - The DELETE id must match `/^\d+$/`, else 404.
  - The export test adds an other-skill row and asserts it is absent.

- [ ] Failing tests:
  - `undo after spending forgives the debt and future gold counts again`;
  - `delete reports goldForgiven`;
  - `recent since returns all entries since a time`;
  - `id 1e0 is not found`;
  - `export excludes other skills`;
  - `undo shows the forgiven-gold note`;
  - `long free timer asks before saving`;
  - `confirm saves the typed minutes`;
  - `free timer subtraction uses since`.
- [ ] Implement, green, commit `fix(guitar): forgive gold debt on undo, ask before long free timers, recent since`.

### Task 6: Tool settings and sound into prefs

**Files:**
- `skills/guitar/game/MetronomePanel.tsx`, `jam/JamRoom.tsx`, `widgets/Tuner.tsx`, `NoteFinder.tsx`, `ChordTrainer.tsx` + their tests;
- `skills/guitar/game/sound/{SoundToggle.tsx,useAmbience.ts}` + tests;
- `packages/server/src/routes/game/settings.ts`, `routes/game/state.ts` (the `sound` field only);
- `packages/core/src/game/prefs/{klang,werkzeuge}.ts`;
- new `skills/guitar/game/migrateLocalPrefs.ts` (+ test).

**Interfaces:**
- `klang.ts`: `"klang.an"`: boolean, default `false`, ui toggle, label "Klang im Dorf".
  - The state field `sound` now reads from prefs, with a fallback to the old `game_settings.sound`.
  - `PUT /settings` writes the pref as well (back-compat). SoundToggle uses `usePref("klang.an")`.
- `werkzeuge.ts`, all ui hidden (the editors stay in the tools):
  - `"werkzeuge.metronom"`: same shape and validator as today's `guitar.metronome`;
  - `"werkzeuge.jam"`: as `guitar.jam`;
  - `"werkzeuge.stimmgeraet.stimmung"`: tuning name;
  - `"werkzeuge.notenfinder.stimmung"`: tuning name;
  - `"werkzeuge.akkordtrainer.eigenesPaar"`: `[string, string]`.
- `migrateLocalPrefs()` runs once per load, from GameShell.
  - For each old localStorage key (`guitar.metronome`, `guitar.jam`, `guitar.tuner.tuning`, `guitar.notefinder.tuning`, `guitar.trainer.customPair`): if the value is present and valid, and the pref still equals its default, PUT the pref.
  - Then remove the old key.
  - Everything goes inside try/catch.
- Tools switch from `usePersistentState` to `usePref` with the same validators. The `songs.scrollSpeed` key stays in `usePersistentState`, because SongView is generic.

- [ ] Failing tests:
  - `old local metronome setting migrates once and is removed`;
  - `existing pref is not overwritten by an old local value`;
  - `tools read and write prefs`;
  - `sound toggle writes klang.an`;
  - `state.sound follows the pref`.
- [ ] Implement, green, commit `feat(guitar): tool settings and sound live in prefs`.

### Task 7: Registries for places and quest tools

**Files:** new `skills/guitar/game/places.ts`, `skills/guitar/game/questTools.tsx`; modify `skills/guitar/widgets/GameApp.tsx`, `skills/guitar/game/Village.tsx`, `skills/guitar/game/QuestView.tsx` + tests (`GameShell.test.tsx`, `QuestLoop.test.tsx`, a new `places.test.ts`).

**Interfaces:**
- `places.ts`:
  ```ts
  export interface PlaceDef { id: string; path: string; label: string; hint: string; sprite: SpriteName; element: (props: WidgetProps) => ReactElement; inMenu: boolean; gated: boolean; ambience?: boolean }
  export const PLACES: PlaceDef[]
  ```
  - It covers every current route under `GAME_BASE` except the index, `quest/:questId` and `einstufung`, which stay explicit.
  - `gated` marks routes inside `PlacementGate`.
  - `ambience` replaces the `ALLOWED` set in `sound/ambience.ts`: export `ambiencePaths()` from places and leave `ambience.ts` importing it. Coordinate this: T6 owns `sound/*`, so **T7 only adds `ambiencePaths()` and does not edit `ambience.ts`**. A later task switches it.
  - Village `MENU` renders from `PLACES.filter(p => p.inMenu)`.
- `questTools.tsx`:
  - `export interface QuestToolProps { quest; scaled; level; state; setBpm; countInBpm; onResult; onRunningChange; cancelSignal }`;
  - `export const QUEST_TOOLS: { id: string; applies: (q: QuestDefinition) => boolean; render: (p: QuestToolProps) => ReactNode }[]`.
  - Move the ChordTrainer, NoteFinder, RiffCard, FretOverlay and Griffbild branches out of QuestView into entries, in the same order.
  - Keep Task 2's `onRunningChange` and `cancelSignal` wiring. T7 starts after T2 has landed (wave 2).
- No visible change. All existing tests stay green.

- [ ] Failing tests:
  - `places registry covers every current menu entry in order`;
  - `village menu renders from the registry`;
  - `quest tools render the same tools as before for a wechsel, note, riff and fretboard quest`.
- [ ] Implement, green, commit `refactor(guitar): registries for places and quest tools`.

### Task 8: Optional device layer and Shrine device check

**Files:** new `skills/guitar/game/devices/{useDevices.ts,DeviceCheck.tsx}` + tests; modify `skills/guitar/game/Places.tsx` (Shrine only), `packages/core/src/game/prefs/geraete.ts`; NoteFinder/Tuner **read-only** this wave. Gating them comes in a later task, to avoid a clash with T6.

**Interfaces:**
- Prefs in `geraete.ts`:
  - `"geraete.gitarreAmMikro"`: `"ja" | "nein" | "spaeter"`, default `"spaeter"`, ui select, labels "Ja" / "Nein, ohne Gerät üben" / "Später fragen", label "Gitarre über Mikrofon oder Interface".
  - `"geraete.eingang"`: string | null, default `null`, ui hidden (the device id).
- `useDevices(): { mic: "unknown" | "denied" | "ok" | "unsupported"; guitar: "ja" | "nein" | "spaeter"; canUse: (what: "mic") => boolean }`.
  - `canUse("mic")` is true only when guitar is `"ja"` and mic is not denied or unsupported.
  - The mic state comes from `navigator.permissions?.query({ name: "microphone" })` when available, else `"unknown"`. Everything goes inside try/catch.
- `DeviceCheck`, shown in the Shrine above the tuner, with the heading "Geräte":
  - a short text;
  - the three-way choice bound to the pref;
  - when "ja": "Pegel testen" starts the mic for 5 s with the existing `InputControls` level meter, a device select, and "Passt" storing the device id.
  - When "nein": the line `"Alles funktioniert auch ohne Gerät – per Klick und mit Referenztönen."`.
- Export `RequireDevice({ what, children, fallback })` for later tasks.

- [ ] Failing tests:
  - `canUse mic is false unless guitar is ja`;
  - `denied permission blocks mic`;
  - `missing permissions API is unknown and does not throw`;
  - `device check stores the choice`;
  - `level test stops after 5 seconds`;
  - `RequireDevice renders fallback without a device`.
- [ ] Implement, green, commit `feat(guitar): optional device layer and Shrine device check`.

### Task 9: Settings screen "Studierstube"

**Files:** new `skills/guitar/game/settings/{Studierstube.tsx,PrefField.tsx,studierstube.css}` + tests; modify `places.ts` (one entry), `StatusBar.tsx` (gear link), `packages/core/src/game/prefs/daten.ts` (none yet), `skills/guitar/assets` only if a sprite is missing (reuse `key` or `scroll`).

**Interfaces:**
- Route `studierstube` with label "Studierstube", hint "Einstellungen", in the menu and not gated.
- The StatusBar gets a gear link with `aria-label="Einstellungen"`.
- One tab per `PrefGroup` that has at least one non-hidden pref, plus "Daten", which is always shown. Tab labels: Allgemein, Klang, Üben, Werkzeuge, Geräte, Darstellung, Mentor, Daten.
- `PrefField` renders a pref by its `ui` kind (toggle → checkbox, select → select, number → number input with min/max clamped on blur), with `help` as a description, plus "Zurücksetzen" per field.
- The Daten tab has:
  - "Daten exportieren" (existing export link);
  - "Alle Einstellungen zurücksetzen" (confirm, then `resetPrefs`);
  - "Intro erneut ansehen", which sets `intro.gesehen=false` and navigates to the village.
- The Geräte tab embeds `DeviceCheck`.
- Responsive at phone width, in the parchment look.

- [ ] Failing tests:
  - `tabs appear only for groups with visible prefs`;
  - `number pref clamps on blur and saves`;
  - `reset one field restores the default`;
  - `reset all asks first`;
  - `replay intro clears intro.gesehen`.
- [ ] Implement, green, commit `feat(guitar): Studierstube settings screen built from the prefs registry`.

### Task 10: Skippable intro tour

**Files:** new `skills/guitar/game/intro/{IntroTour.tsx,intro.json,intro.css}` + tests, `content.test.ts` (an intro content test); modify `skills/guitar/game/GameShell.tsx` (mount), `Village.tsx` (`data-intro` attributes on hotspots), and a "?" help button per place in `Places.tsx`'s `ToolFrame` (one prop).

**Interfaces:**
- `intro.json`: `{ steps: { id: string; target: string | null; title: string; text: string; place?: string }[] }`, with 6–9 steps:
  - welcome (mentor Meister Orlo);
  - village and Quest Board;
  - "Heute" panel;
  - map (Harbor);
  - tools (Forge / Shrine / Jam);
  - "Frei üben";
  - Chronicle;
  - Studierstube;
  - goodbye.
  - `target` is a `data-intro` attribute value or null (centred).
  - Text at most 2 short sentences each, German, encouraging, no guilt.
- The tour shows when `intro.gesehen === false` and prefs are loaded. It runs **before** Placement: GameShell renders it over any route; on finish or skip it sets the pref and then the PlacementGate redirect runs as today.
- Controls: "Weiter", "Zurück", "Überspringen" (always visible, focus starts on Weiter), Esc = skip. A dialog with a focus trap, spotlight cut-out around the target (CSS box-shadow), and reduced motion respected.
- `ToolFrame` gets an optional `helpStepId` prop. The "?" button opens only that step.

- [ ] Failing tests:
  - `tour shows on first launch and not after skip`;
  - `escape skips`;
  - `finish sets intro.gesehen`;
  - `help button shows one step`;
  - `intro steps have known targets and short text`;
  - `placement redirect happens after the tour`.
- [ ] Implement, green, commit `feat(guitar): skippable intro tour with Meister Orlo`.

### Task 12: Device gating in tools, ambience from the places registry

**Files:** `skills/guitar/game/NoteFinder.tsx`, `skills/guitar/widgets/Tuner.tsx`, `skills/guitar/game/sound/ambience.ts` + tests.

**Changes:**
- NoteFinder: "Mit Gitarre spielen" is rendered only when `canUse("mic")`, or when the guitar pref is `"spaeter"`. In that case, the first click asks inline `"Spielst du mit Gitarre am Mikrofon?" Ja / Nein`, sets the pref, and continues.
- Tuner: same rule for the mic start button. Reference tones always stay.
- When guitar is `"nein"`: no mic UI, with a small link `"Gerät einrichten"` to the Geräte tab of the Studierstube.
- `ambience.ts`: `ambienceAllowed` uses `ambiencePaths()` from `places.ts` (Task 7) instead of its own `ALLOWED` sets. Same result for every current path; the existing tests prove it.

- [ ] Failing tests:
  - `note finder hides mic with device nein`;
  - `spaeter asks once then remembers`;
  - `tuner keeps reference tones without device`;
  - `ambience paths come from places`.
- [ ] Implement, green, commit `feat(guitar): gate microphone features behind the device choice`.

### Task 11: e2e and docs

**Files:** new `e2e/guitar-phase1.spec.ts`; `e2e/guitar-helpers.ts` (a helper to skip the intro, used by **all** existing specs, so they keep passing); `README.md`; new `skills/guitar/reference/einstellungen.mdx`, following the meta format of the other reference files.

- [ ] e2e:
  - `intro can be skipped and replayed from the Studierstube`;
  - `a changed pref survives reload`;
  - `device Nein hides microphone buttons in the Note Finder`.
- [ ] All existing e2e specs green with the skip helper. Full vitest and typecheck green.
- [ ] Commit `test(e2e): cover intro, prefs and devices; document settings`.
