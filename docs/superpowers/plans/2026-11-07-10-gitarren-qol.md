# Guitar QOL Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the twelve QOL gaps found in the 2026-11-07 audit of the guitar RPG: free practice counts, log entries can be undone, the screen stays awake, quests pause, keyboard shortcuts, remembered tool settings, a usable song metronome, a real count-in, free chord pairs, a richer Chronicle, Note Finder tunings and a microphone that stays on.

**Architecture:** Server gets log ids, a recent-log list, delete and export routes. Three small shared hooks live in `packages/web/src/app/` (wake lock, persisted state, practice keys) so the guitar game and the generic SongView can both use them. Everything else is local changes to existing components.

**Tech Stack:** TypeScript, React 18, react-router, TanStack Query, Hono + better-sqlite3, zod, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md` (anti-goals and tools table). Audit list: items 1–12 in the session report of 2026-11-07.

## Global Constraints

- All UI text German. Straight quotes as in the existing code.
- Anti-goals: no guilt mechanics, no XP for doing nothing, sound must not interfere with practice, no more clicking than playing.
- Free practice logs `kind: "frei"`, `level: 1`; the server cap stays `seconds <= 14400`.
- `localStorage` access always inside try/catch; a broken or missing value falls back to the default.
- Shared hooks in `packages/web/src/app/` must not import from `skills/` (SongView stays free of game calls).
- Run `npm test` and `npm run typecheck` green before every commit. Stop `npm run dev` before e2e.
- Commit on master, one commit per task, message ending with the attribution line.

## Review Focus

- Deleting a log entry after gold was spent: wallet clamps at 0, state must still load (Task 1 test).
- Wake lock unsupported (`navigator.wakeLock` missing) or request rejected: no error shown, nothing breaks (Task 3 test).
- Shortcut keys while typing in an input (minutes field, BPM field): must not fire (Task 3 test).
- Stored settings from an older shape (accents length ≠ beats, unknown style): ignored, defaults used (Task 3 validate test, Task 7 test).
- Quest paused across reload: elapsed time stays frozen after reload (Task 6 test).

---

### Task 1: Server log ids, recent list, delete, export

**Files:**
- Modify: `packages/server/src/routes/game.ts`, `packages/core/src/game/api-types.ts`, `skills/guitar/game/api.ts`
- Test: `packages/server/src/routes/game.test.ts`

**Interfaces:**
- Produces (core `api-types.ts`):
  - `LogResult` moves to core and gains `logId: number` (api.ts re-exports `type LogResult` from core so existing imports keep working).
  - `interface RecentLogEntry { id: number; at: number; day: string; kind: "quest" | "frei"; questId: string | null; techniqueId: string | null; seconds: number; metricKey: string | null; metricValue: number | null }`
- Produces (routes):
  - `POST /api/game/:skillId/log` response adds `logId` (the inserted rowid).
  - `GET /api/game/:skillId/log/recent` → `{ entries: RecentLogEntry[] }`, newest first, max 20.
  - `DELETE /api/game/:skillId/log/:id` → `{ ok: true }`; 404 `{ error: { code: "not_found", message: "Eintrag nicht gefunden." } }` when no row with that id and skill. Lesson statuses already raised by the entry stay (documented in a code comment).
  - `GET /api/game/:skillId/export` → JSON of every row of the skill in `game_log, game_levels, game_today, game_profile, game_chosen, game_songs, game_story_seen, game_inventory, game_equipped, game_settings` plus `lesson_progress`, as `{ exportedAt: number, skillId, tables: Record<string, unknown[]> }`, header `content-disposition: attachment; filename="guitar-export-<day>.json"`.
- Produces (`api.ts` `gameApi`): `recentLog(): Promise<{ entries: RecentLogEntry[] }>`, `deleteLog(id: number): Promise<{ ok: true }>` (via `refreshing`, and also invalidates `[...GAME_KEY, "history"]` and `[...GAME_KEY, "recent"]` — the GAME_KEY prefix already covers both), `exportUrl: string` = `/api/game/guitar/export`. Hook `useRecentLog()` with queryKey `[...GAME_KEY, "recent"]`.

- [ ] **Step 1: Write failing tests** in `game.test.ts`:
  - `log returns logId and recent lists it first` — two logs, `recent.entries[0].id === second.logId`, length 2.
  - `delete removes the entry from state totals` — log 600 s, delete, state `totalSeconds === 0`, `xp === 0`.
  - `delete of unknown id is 404` and `delete of another skill's id is 404`.
  - `delete after spending gold keeps state loading` — log enough for gold, buy cheapest item, delete log, state 200 and `gold === 0`.
  - `export contains the log rows` — `tables.game_log.length === 1`, content-disposition contains `guitar-export-`.
- [ ] **Step 2:** `npx vitest run packages/server/src/routes/game.test.ts` → new tests FAIL.
- [ ] **Step 3:** Implement routes and types as above. Recent query: `ORDER BY at DESC, id DESC LIMIT 20`.
- [ ] **Step 4:** Tests PASS; `npm run typecheck` green.
- [ ] **Step 5:** Commit `feat(guitar): log ids, undo route, recent log and export`.

### Task 2: Shared hooks — wake lock, persisted state, practice keys

**Files:**
- Create: `packages/web/src/app/useWakeLock.ts`, `packages/web/src/app/usePersistentState.ts`, `packages/web/src/app/usePracticeKeys.ts`
- Test: `packages/web/src/app/hooks.test.tsx`

**Interfaces:**
- Produces:
  - `useWakeLock(active: boolean): void` — requests `navigator.wakeLock.request("screen")` while `active`, releases when inactive or unmounted, re-requests on `visibilitychange` to visible while active. Missing API or rejected request: silent.
  - `usePersistentState<T>(key: string, initial: T, validate: (raw: unknown) => raw is T): [T, (next: T) => void]` — reads `localStorage[key]` (JSON) once, validates, writes on set. All storage calls in try/catch.
  - `usePracticeKeys(bindings: Record<string, () => void>, enabled = true): void` — keydown on `window`; keys are `KeyboardEvent.key` values (`" "`, `"Enter"`, `"p"`, `"s"`), matched case-insensitively for letters. Ignores events with `ctrlKey/metaKey/altKey`, `repeat`, and events whose target is `input, textarea, select, button, [contenteditable]`. Calls `preventDefault()` when a binding fires.

- [ ] **Step 1: Write failing tests:**
  - `wake lock requests when active and releases when inactive` (mock `navigator.wakeLock.request` returning `{ release: vi.fn() }`).
  - `wake lock without API does nothing and does not throw`.
  - `persistent state falls back on invalid stored value` (`localStorage.setItem(k, '"x"')`, validator for number → initial).
  - `persistent state writes and survives remount`.
  - `persistent state survives throwing localStorage` (spy `getItem` throws).
  - `practice keys fire space and ignore inputs` — space on body calls handler; keydown dispatched on an `<input>` does not; `ctrlKey` does not.
- [ ] **Step 2:** `npx vitest run packages/web/src/app/hooks.test.tsx` → FAIL.
- [ ] **Step 3:** Implement the three hooks.
- [ ] **Step 4:** PASS, typecheck green.
- [ ] **Step 5:** Commit `feat(web): wake lock, persistent state and practice key hooks`.

### Task 3: Chord Trainer count-in clicks and free pair

**Files:**
- Modify: `packages/web/src/audio/signalTone.ts`, `skills/guitar/game/ChordTrainer.tsx`, `skills/guitar/game/QuestView.tsx` (only the `<ChordTrainer>` props line)
- Test: `skills/guitar/game/ChordTrainer.test.tsx`, `packages/web/src/audio/signalTone.test.ts`

**Interfaces:**
- Produces: `playClick(accent: boolean): void` in `signalTone.ts` (short 1600 Hz accent / 900 Hz normal click, same AudioContext handling as `playSignal`).
- Produces: `ChordTrainer` prop `countInBpm?: number` (default 80). Count-in = 4 beats of `60000 / countInBpm` ms; `playClick(true)` on beat 1, `playClick(false)` on 2–4, then `playSignal("start")` and the 60 s round. The big number shows the beats left (4,3,2,1) during count-in. QuestView passes `countInBpm={scaled.bpm ?? undefined}`.
- Produces: when no `pair` prop, the pair select gets a last option `Eigenes Paar…`; choosing it shows two text inputs (`aria-label="Erster Akkord"` / `"Zweiter Akkord"`); Start is disabled with hint `Unbekannter Akkord` unless both pass `chordShape(name) !== null` (from `@skills/core`). The custom pair persists via `usePersistentState("guitar.trainer.customPair", ["C","G"], isPairOfStrings)`.
- Produces: key `s` starts a round (via `usePracticeKeys`) when phase is `pick` or `done`.

- [ ] **Step 1: Failing tests:** `count-in clicks four times before the start signal` (fake timers, mock signalTone: 4 `playClick` calls, first with `true`, then `playSignal("start")`); `count-in follows countInBpm` (120 BPM → start after 2000 ms); `custom pair logs its metric key` (type `C`, `G7`, run round, POST body `metricKey === "wechsel:C-G7"`); `unknown custom chord disables start`; `s key starts a round`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS (`npx vitest run skills/guitar/game/ChordTrainer.test.tsx packages/web/src/audio`), typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): count-in clicks and free chord pair in the Chord Trainer`.

### Task 4: Note Finder tunings and a microphone that stays on

**Files:**
- Modify: `skills/guitar/game/NoteFinder.tsx`
- Test: `skills/guitar/game/NoteFinder.test.tsx`

**Interfaces:**
- Produces: `NoteFinder` prop `tuning?: string` (a `TUNINGS` name). Without the prop a `Stimmung` select (all `TUNINGS`) shows while not running, persisted via `usePersistentState("guitar.notefinder.tuning", "Standard", isTuningName)`. String labels derive from the tuning (`displayNote` of the open note without octave), not the fixed `STRING_NAMES`; `CHOICES` labels follow (`"D-Saite"` in Drop D). The metric key stays `notenfinder:<strings>` for Standard and becomes `notenfinder:<tuning>:<strings>` otherwise.
- Behaviour: `finish()` and `cancel()` no longer call `mic.stop()`; the mic stops only via its button or unmount.

- [ ] **Step 1: Failing tests:** `drop d tuning labels the low string D and scores D on fret 0`; `mic stays running after a round ends` (mock mic, round ends, `stop` not called); `tuning metric key includes tuning name`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement. Check `useMicrophone` stops on unmount; if not, add an unmount cleanup in NoteFinder.
- [ ] **Step 4:** PASS, typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): Note Finder tunings and a microphone that stays on`.

### Task 5: Undo after saving a result

**Files:**
- Modify: `skills/guitar/game/ResultDialog.tsx`, `skills/guitar/game/ChordTrainer.tsx`, `skills/guitar/game/NoteFinder.tsx`
- Create: `skills/guitar/game/UndoButton.tsx`
- Test: `skills/guitar/game/UndoButton.test.tsx`

**Interfaces:**
- Consumes: `gameApi.deleteLog(id)`, `LogResult.logId` (Task 1).
- Produces: `UndoButton({ logId, onUndone }: { logId: number; onUndone?: () => void })` — button `Rückgängig`; on click deletes, then shows `Eintrag entfernt.`; on failure `role="alert"` `Das konnte nicht rückgängig gemacht werden.`; disabled while busy.
- Placement: in ResultDialog's result view, and in the ChordTrainer/NoteFinder result block (only when they logged themselves, i.e. no `onResult`). ResultDialog `onUndone` hides the XP lines and shows the removal note; quest stays cleared.

- [ ] **Step 1: Failing tests:** `undo deletes the logged entry` (fetch mock sees `DELETE /api/game/guitar/log/7`); `undo failure shows alert`; `undo cannot be sent twice`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement and place.
- [ ] **Step 4:** PASS incl. existing `ChordTrainer`, `NoteFinder`, `QuestLoop` tests (update their log mocks to return `logId`). Typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): undo a saved result`.

### Task 6: Free practice in the status bar

**Files:**
- Create: `skills/guitar/game/FreePractice.tsx`
- Modify: `skills/guitar/game/StatusBar.tsx`, `skills/guitar/game/game.css`
- Test: `skills/guitar/game/FreePractice.test.tsx`

**Interfaces:**
- Consumes: `gameApi.log`, `UndoButton` (Task 5) — if Task 5 is not merged yet, leave the undo line out and add it in Task 11.
- Produces: `FreePractice()` rendered in `StatusBar` after the week stat. A button `Frei üben` toggles a small panel (`role="dialog" aria-label="Frei üben"`) with:
  - What: select `Song`, `Technik`, `Jammen`, `Sonstiges` → `techniqueId` `song`, `frei-technik`, `jam`, `frei`.
  - Timer: `Timer starten` / `Timer stoppen und speichern`; start time in `localStorage["guitar.freeTimer"]` as `{ startedAt, techniqueId }` so it survives reload and route changes; while running the button in the bar shows the elapsed `m:ss`.
  - Manual: number input `Minuten` (1–240) and `Eintragen`.
  - Under 1 minute timed: no log, note `Unter einer Minute, nichts gespeichert.`
  - After saving: `+N XP · +M Gold` and the undo line.
- Wake lock: `useWakeLock(timerRunning)`.

- [ ] **Step 1: Failing tests:** `manual minutes log a free entry` (POST body `{kind:"frei", seconds:1200, level:1, techniqueId:"song"}`); `timer survives remount` (start, unmount, remount → still running); `short timer logs nothing`; `minutes outside 1–240 are refused` with hint.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement; style panel in `game.css` like `.quest-result` (parchment), anchored under the bar, full width on phones.
- [ ] **Step 4:** PASS, existing `StatusBar.test.tsx` green, typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): log free practice from the status bar`.

### Task 7: Quest pause, wake lock and shortcuts

**Files:**
- Modify: `skills/guitar/game/QuestView.tsx`, `skills/guitar/game/game.css`
- Test: `skills/guitar/game/QuestLoop.test.tsx` (add a `describe("pause and keys")`)

**Interfaces:**
- Consumes: `useWakeLock`, `usePracticeKeys` (Task 2).
- Produces: `sessionStorage["game.activeQuest"]` shape becomes `{ questId, startedAt, pausedAt: number | null, pausedMs: number }`; old entries without the new fields read as `pausedAt: null, pausedMs: 0`. Elapsed seconds = `(now - startedAt - pausedMs - (pausedAt ? now - pausedAt : 0)) / 1000`, floored, min 0.
- UI: button `Pause` / `Weiter` next to the timer; pausing stops the metronome; while paused the timer shows `Pausiert` and `Fertig` uses the frozen time.
- Keys (disabled while the ResultDialog shows): `" "` toggles the metronome, `"p"` toggles pause, `"Enter"` = Fertig. A line `Tasten: Leertaste Metronom · P Pause · Enter Fertig` in small text under the buttons (hidden on `(pointer: coarse)` via CSS).
- Wake lock active while the quest runs and is not paused.

- [ ] **Step 1: Failing tests:** `pause freezes the timer` (fake timers: run 60 s, pause, 60 s, Fertig → ResultDialog prefilled 1 minute); `paused state survives remount`; `old stored entry without pause fields still resumes`; `space toggles the metronome and enter finishes`; `keys do nothing while typing in the result minutes field`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS, whole `QuestLoop.test.tsx` green, typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): pause quests, keep the screen awake, add shortcuts`.

### Task 8: Remembered settings in metronome, Jam Room and Tuner

**Files:**
- Modify: `skills/guitar/game/MetronomePanel.tsx`, `skills/guitar/game/jam/JamRoom.tsx`, `skills/guitar/widgets/Tuner.tsx`
- Test: `skills/guitar/game/MetronomePanel.test.tsx`, `skills/guitar/game/jam/JamRoom.test.tsx`, `skills/guitar/widgets/Tuner.test.tsx`

**Interfaces:**
- Consumes: `usePersistentState`, `useWakeLock`, `usePracticeKeys` (Task 2).
- MetronomePanel: persists `{ beatsPerBar, subdivision, accents, stepBpm, everyBars }` under `guitar.metronome`; on mount applies the stored beats/subdivision/accents to the hook (accents only when `accents.length === beatsPerBar`). BPM is not stored (quests set it).
- JamRoom: persists `{ root, style, bpm, box, volume }` under `guitar.jam`; validator rejects unknown root/style and bpm outside 50–220. `useWakeLock(running)`; `" "` toggles start/stop.
- Tuner: persists the tuning name under `guitar.tuner.tuning`; an `initialTuning` prop (URL) wins over the stored one.

- [ ] **Step 1: Failing tests:** `metronome restores beats and accents`; `stale accents are ignored`; `jam restores style and bpm`; `jam ignores unknown stored style`; `jam space starts and stops`; `tuner url tuning beats stored tuning`; `tuner restores stored tuning`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS, typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): remember metronome, Jam Room and tuner settings`.

### Task 9: Song view tempo, count-in and wake lock

**Files:**
- Modify: `packages/web/src/features/songs/SongView.tsx`
- Test: `packages/web/src/features/songs/SongView.test.tsx`

**Interfaces:**
- Consumes: `useWakeLock`, `usePersistentState` (Task 2).
- UI next to the existing metronome button: `−5` / `+5` buttons and a number input `aria-label="Metronom-BPM"` (40–240); button `Einzählen und scrollen` starts the metronome, then starts auto-scroll after one bar (`beatsPerBar * 60000 / bpm` ms); a running count-in can be stopped by the auto-scroll stop button.
- Scroll speed persists under `songs.scrollSpeed` (5–100).
- `useWakeLock(scrolling || metronome.running)`.

- [ ] **Step 1: Failing tests:** `bpm buttons change the metronome tempo`; `count-in starts scrolling after one bar` (fake timers, 120 BPM 4/4 → scrolling after 2000 ms, not before); `scroll speed survives remount`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS, typecheck green.
- [ ] **Step 5:** Commit `feat(songs): metronome tempo, count-in and wake lock in the song view`.

### Task 10: Chronicle calendar, accessible tooltips, recent log, export

**Files:**
- Create: `skills/guitar/game/chronicle/DayCalendar.tsx`, `skills/guitar/game/chronicle/RecentLog.tsx`
- Modify: `skills/guitar/game/chronicle/Chronicle.tsx`, `skills/guitar/game/chronicle/LineChart.tsx`, `packages/core/src/game/chronicle.ts`
- Test: `skills/guitar/game/chronicle/Chronicle.test.tsx`, `packages/core/src/game/chronicle.test.ts`

**Interfaces:**
- Consumes: `useRecentLog`, `gameApi.deleteLog`, `gameApi.exportUrl` (Task 1).
- Produces (core): `dayGrid(days: History["days"], today: string, weeks = 12): { day: string; minutes: number }[][]` — weeks (Monday start) oldest first, each 7 days, future days of the current week omitted.
- DayCalendar: grid of squares, 4 shades by minutes (0, 1–14, 15–29, 30+), each cell `title` and `aria-label` like `3. Nov. 2026: 25 min`. Heading `Übungstage`. No red/missed marking (no guilt).
- LineChart: each point is focusable (`tabIndex={0}`), shows the same tooltip on focus and on `pointerdown` (touch); x labels include the year (`3.11.26`).
- RecentLog: heading `Letzte Einträge`, list of `RecentLogEntry` with date, quest title (from `gameContent.quests`) or the free label, minutes, metric; each has `Löschen` with a `confirm("Diesen Eintrag löschen?")`.
- Export: link `Daten exportieren` (`href={gameApi.exportUrl}`, `download`).

- [ ] **Step 1: Failing tests:** core `dayGrid groups by monday weeks and omits future days`; `calendar shades a 30 minute day darkest`; `chart point shows tooltip on focus`; `x labels show the year`; `recent entry delete calls the route after confirm`; `export link points at the export route`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implement.
- [ ] **Step 4:** PASS, typecheck green.
- [ ] **Step 5:** Commit `feat(guitar): Chronicle day calendar, recent log, export and touch tooltips`.

### Task 11: e2e, docs and final pass

**Files:**
- Modify: `e2e/guitar-tools.spec.ts` (or new `e2e/guitar-qol.spec.ts`), README guitar section if it lists features.

- [ ] **Step 1:** e2e `free practice entry raises week time and can be undone` (open Frei üben, enter 5 min, week stat grows, Rückgängig, back).
- [ ] **Step 2:** e2e `quest pause freezes the timer`.
- [ ] **Step 3:** Stop dev server; `npm run test:e2e -- e2e/guitar-qol.spec.ts` → PASS; full `npm test`, `npm run typecheck` green.
- [ ] **Step 4:** Update README guitar feature list with the new features (German or English as the README already is).
- [ ] **Step 5:** Commit `test(e2e): cover free practice, undo and quest pause`.

## Execution order

- Wave A (parallel, no shared files): Task 1, Task 2, Task 3, Task 4.
- Wave B (parallel, no shared files): Task 5, Task 6, Task 7, Task 8, Task 9, Task 10. Task 6 needs Task 5's `UndoButton` — run Task 5 first inside wave B, or let Task 6 add the undo line after Task 5 lands.
- Then Task 11 and a final whole-branch review.
