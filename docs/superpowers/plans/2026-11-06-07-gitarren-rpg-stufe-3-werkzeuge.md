# Guitar RPG Stage 3: Tools Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring every guitar tool up to the spec: a full metronome, fretboard overlays, a note-finding game with input picker, better Tavern, Chronicle graphs, a Jam Room, a riff viewer, and a phone layout with an opt-in home-network start.

**Architecture:** Pure rules go into `packages/core` (click patterns, scales and shapes, note matching, jam patterns, chronicle series). Audio stays in hooks on top of one shared lookahead scheduler. Quests gain optional tool fields (`fretboard`, `noteGame`, `riffId`, `tuning`), so the quest view shows the tool it needs. New game data goes into one new table, `game_songs`, and one read route, `/history`.

**Tech Stack:** TypeScript, React 18, React Router 6, TanStack Query, Hono, better-sqlite3, zod, Web Audio, hand-written SVG, Vitest, Testing Library, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md`

**Scope:** Stage 3 of 5, as assigned by the "Later stages" table of the stage 1 plan. Lessons and story are stage 4. Market, ambience and unified tool frames are stage 5. Baseline before this plan: 73 test files, 821 tests, all passing.

## Global Constraints

- All instructions, tips, buttons and text in German. Names of regions and titles may stay English.
- Automatic judging of the owner's playing from audio is a non-goal. Results are self-reported. The only microphone game is note finding on the fretboard.
- Note finding must tolerate room noise and metronome bleed, and always offers the click fallback.
- Turn off browser echo cancellation, noise suppression and auto gain for pitch detection. Microphone features stay PC only.
- More clicking than playing is a failure. No leaving the quest to find a tool.
- XP never comes from doing nothing. Rewards follow practice time and honest answers.
- Sound that interferes with practice is a failure. The game itself stays silent during quests, tuner and microphone use, except metronome and trainer signals.
- All riffs and exercises are original. No commercial tabs or lyrics shipped.
- Existing songs and chord overrides remain untouched and usable. Target song state stays separate from the free-text `songs` rows.
- Jam Room uses Web Audio synthesis, no sample library. Reuse the lookahead scheduling idea of `useMetronome`.
- Default stays localhost only. Home-network access needs an explicit opt-in start command, because the app has no login.
- Game state in SQLite. Date logic uses the local day. Japanese, demo, review and Anki features stay unchanged.
- Stop `npm run dev` before e2e. The e2e database is `packages/server/data/e2e.db`. Never touch `packages/server/data/app.db`, except read-only.
- Work on `master`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A saved input device that is unplugged must fall back to the default device with a German note, never a dead screen. Test in Task 6.
- Leaving the Jam Room while it plays must stop all sound and log the time exactly once, also under React StrictMode. Test in Task 13.
- A speed trainer with a target below its start, or a BPM moved by hand mid-run, must never jump or run past 300. Test in Task 2.
- Boxes and CAGED shapes near the top of the neck must stay on the 15 drawn frets, and a non-standard tuning must say they do not apply instead of drawing wrong places. Tests in Tasks 4 and 5.
- A loop on a section shorter than the song window, or on one of two sections with the same name, must not jitter or pick the wrong section. Test in Task 9.

---

## File Structure

```
packages/core/src/
  audio/click.ts            subdivisions, accents, speed trainer
  audio/level.ts            input level 0..1
  music/scales.ts           scales, pentatonic boxes, CAGED, displayNote
  music/jam.ts              jam styles, bars, chords
  game/noteFinder.ts        targets, matching, hold detector
  game/chronicle.ts         weekly minutes, metric series and groups
  game/quests.ts            modified: tool fields, riffs
  game/api-types.ts         modified: day, SongMeta, History
packages/server/src/
  db/client.ts              modified: game_songs
  routes/game.ts            modified: day, songs, history
  routes/songs.ts           modified: delete cleans meta
  devLan.ts                 opt-in home-network start
packages/web/src/
  audio/lookahead.ts        shared scheduler
  audio/useMetronome.ts     modified
  audio/useMicrophone.ts    modified: deviceId, fallback
  audio/useInputDevices.ts  device list and choice
  features/songs/autoScroll.ts, SongView.tsx
skills/guitar/game/
  MetronomePanel.tsx, FretboardGrid.tsx, FretOverlay.tsx, InputControls.tsx
  NoteFinder.tsx, RiffViewer.tsx, riffs.json
  chronicle/Chronicle.tsx, chronicle/LineChart.tsx, chronicle/MinutesBars.tsx
  jam/useJamEngine.ts, jam/JamRoom.tsx
e2e/guitar-tools.spec.ts, e2e/guitar-phone.spec.ts
```

---

### Task 1: Midnight guard for the quest set

The parked stage 2 finding: "Quest starten" can write yesterday's set past midnight before a refetch. The server stores under its own today, so stale ids land on the new day.

**Files:**
- Modify: `packages/core/src/game/api-types.ts`, `packages/server/src/routes/game.ts`, `skills/guitar/game/useTodaySet.ts`
- Test: `packages/server/src/routes/game.test.ts`, `skills/guitar/game/QuestLoop.test.tsx`

**Interfaces:**
- Produces: `GameState.day: string`, the server's local day key.

- [ ] **Step 1: Write the failing tests**

Server: `it("reports the local day in the state")` asserts `state.day === localDayKey(Date.now())`.

Web: `it("does not write a set built on yesterday's state")` renders the board with a state whose `day` is the day before `localDayKey(Date.now())`, clicks "Quest starten", and asserts no `PUT .../today` went out, no navigation happened, and the game state was refetched.

- [ ] **Step 2: Run them and see them fail**

Run: `npx vitest run packages/server/src/routes/game.test.ts skills/guitar/game/QuestLoop.test.tsx`
Expected: FAIL. Add `day` to every `GameState` fixture the type now needs.

- [ ] **Step 3: Add `day` to the state, and guard `save` in `useTodaySet`**

At the top of `save`: if `state.day !== localDayKey(Date.now())`, invalidate `["game", "guitar"]` and return `false`. The auto-build effect then rebuilds from fresh state.

- [ ] **Step 4: Run tests, expect PASS, run `npm run typecheck`**

- [ ] **Step 5: Commit** `fix(guitar): never write yesterday's quest set after midnight`

---

### Task 2: Click patterns, speed trainer and shared scheduler

**Files:**
- Create: `packages/core/src/audio/click.ts`, `packages/core/src/audio/click.test.ts`, `packages/web/src/audio/lookahead.ts`
- Modify: `packages/core/src/index.ts`, `packages/web/src/audio/useMetronome.ts`
- Test: `packages/web/src/audio/useMetronome.test.ts`

**Interfaces:**
- Produces in core:

```ts
export type Subdivision = "viertel" | "achtel" | "triole" | "sechzehntel" | "galopp";
export const SUBDIVISIONS: Record<Subdivision, { label: string; pattern: boolean[] }>;
export type ClickLevel = "betont" | "schlag" | "unter" | "stumm";
export interface ClickSettings { beatsPerBar: number; subdivision: Subdivision; accents: boolean[] }
export function clickLevel(step: number, settings: ClickSettings): ClickLevel;
export function defaultAccents(beatsPerBar: number): boolean[];
export interface SpeedTrainer { startBpm: number; targetBpm: number; stepBpm: number; everyBars: number }
export function speedTrainerBpm(trainer: SpeedTrainer, barsDone: number): number;
```

- Produces in web: `startLookahead({ context, stepSeconds, onStep }: { context: AudioContext; stepSeconds: () => number; onStep: (time: number, index: number) => void }): () => void`, returning the stop function.
- `useMetronome()` additionally returns `subdivision`, `setSubdivision`, `accents`, `toggleAccent(beat)`, `speedTrainer`, `setSpeedTrainer(value | null)`.

- [ ] **Step 1: Write the failing core tests**

```ts
const base = { beatsPerBar: 4, subdivision: "viertel" as const, accents: defaultAccents(4) };
expect(clickLevel(0, base)).toBe("betont");
expect(clickLevel(1, base)).toBe("schlag");
expect(clickLevel(4, base)).toBe("betont");
const gallop = { ...base, subdivision: "galopp" as const };
expect([0, 1, 2, 3].map((s) => clickLevel(s, gallop))).toEqual(["betont", "stumm", "unter", "unter"]);
expect(clickLevel(4, gallop)).toBe("schlag");
const triplet = { ...base, subdivision: "triole" as const };
expect(clickLevel(3, triplet)).toBe("schlag");
expect(clickLevel(2, { ...base, accents: [true, false, true, false] })).toBe("betont");

const t = { startBpm: 60, targetBpm: 70, stepBpm: 4, everyBars: 2 };
expect(speedTrainerBpm(t, 0)).toBe(60);
expect(speedTrainerBpm(t, 1)).toBe(60);
expect(speedTrainerBpm(t, 2)).toBe(64);
expect(speedTrainerBpm(t, 100)).toBe(70);
expect(speedTrainerBpm({ ...t, targetBpm: 50 }, 10)).toBe(60); // target below start stays at start
expect(speedTrainerBpm({ ...t, targetBpm: 400, stepBpm: 100 }, 100)).toBe(300);
expect(speedTrainerBpm({ ...t, stepBpm: 0 }, 10)).toBe(60);
expect(speedTrainerBpm({ ...t, everyBars: 0 }, 10)).toBe(60);
```

- [ ] **Step 2: Run, expect FAIL** with `npx vitest run packages/core/src/audio/click.test.ts`

- [ ] **Step 3: Implement `click.ts`**

Patterns, one entry per step of a beat, index 0 being the beat: `viertel [true]`, `achtel [true,true]`, `triole [true,true,true]`, `sechzehntel [true,true,true,true]`, `galopp [true,false,true,true]`. Labels: Viertel, Achtel, Triolen, Sechzehntel, Galopp. Step 0 of a beat is `betont` if `accents[beat]`, else `schlag`. Other steps are `unter` or `stumm`. BPM stays within 20 to 300.

- [ ] **Step 4: Write failing hook tests** in `useMetronome.test.ts`

- `it("plays subdivisions between the beats")`: at "achtel", more oscillators start per beat than at "viertel".
- `it("raises the tempo bar by bar with the speed trainer")`: with `{startBpm: 60, targetBpm: 68, stepBpm: 4, everyBars: 1}`, advancing fake time over two bars makes `bpm` 68 at most and never lowers it.
- `it("ends the speed trainer when the tempo is set by hand")`: `setBpm(100)` while running leaves `speedTrainer` null and `bpm` 100. `tap` does the same.
- `it("resets accents when the beats per bar change")`: `accents` then has the new length, with only beat 1 on.

- [ ] **Step 5: Create `lookahead.ts` and move the scheduling loop into it**

Keep 25 ms ticks and 0.1 s ahead. While `document.hidden`, look 1.5 s ahead, since browsers throttle timers in background tabs to about one per second. `useMetronome` schedules per step. Clicks: `betont` 1600 Hz, `schlag` 900 Hz, `unter` 600 Hz at half gain, `stumm` nothing. `currentBeat` changes on beats only. The trainer sets `bpmRef` at the first step of a bar.

- [ ] **Step 6: Run `npx vitest run packages/web/src/audio packages/core/src/audio`, expect PASS. All old hook tests stay green.**

- [ ] **Step 7: Commit** `feat(metronome): add accents, subdivisions and speed trainer`

---

### Task 3: Metronome panel in every quest

**Files:**
- Create: `skills/guitar/game/MetronomePanel.tsx`, `skills/guitar/game/MetronomePanel.test.tsx`
- Modify: `skills/guitar/game/QuestView.tsx` (remove the local `Metronome`), `skills/guitar/game/game.css`

**Interfaces:**
- Consumes: `useMetronome()` from Task 2.
- Produces: `MetronomePanel({ metronome }: { metronome: ReturnType<typeof useMetronome> })`, reused by Tasks 11 and 13.

- [ ] **Step 1: Write the failing tests**

- `it("offers every subdivision")`: a select labelled "Unterteilung" holds Viertel, Achtel, Triolen, Sechzehntel, Galopp.
- `it("toggles an accent per beat")`: buttons named "Betonung Schlag 1" to "Schlag 4" with `aria-pressed`. Only the first is pressed at the start, and a click flips it.
- `it("starts the speed trainer from the current tempo")`: open "Tempotrainer", fill Bis 100, Plus 4, Alle 2 Takte, press "Tempotrainer starten". The hook then has `{startBpm: 80, targetBpm: 100, stepBpm: 4, everyBars: 2}` and the metronome is running.
- `it("rejects a target below the start")`: Bis 60 at 80 BPM disables the button and shows "Das Ziel muss über dem aktuellen Tempo liegen."

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run skills/guitar/game/MetronomePanel.test.tsx`

- [ ] **Step 3: Implement the panel**

Start/stop, BPM slider, Tap and beats per bar (2 to 7) stay visible. Trainer fields sit in a `<details>` titled "Tempotrainer", so the quest stays short. While running it shows "Tempotrainer: 84 → 100 BPM" and a stop button.

- [ ] **Step 4: Run `npx vitest run skills/guitar/game`, expect PASS** (`QuestLoop.test.tsx` included)

- [ ] **Step 5: Commit** `feat(guitar): full metronome panel in quests`

---

### Task 4: Scales, pentatonic boxes and CAGED shapes

**Files:**
- Create: `packages/core/src/music/scales.ts`, `packages/core/src/music/scales.test.ts`
- Modify: `packages/core/src/music/index.ts`

**Interfaces:**

```ts
export type ScaleId = "dur" | "moll" | "moll-pentatonik";
export const SCALES: Record<ScaleId, { label: string; intervals: number[] }>;
export interface FretPosition { stringIndex: number; fret: number } // stringIndex 0 is the low E
export const MAX_FRET = 15;
export function inScale(note: string, root: string, scale: ScaleId): boolean;
export function pentatonicBox(root: string, box: 1 | 2 | 3 | 4 | 5): FretPosition[];
export type CagedShape = "C" | "A" | "G" | "E" | "D";
export function cagedShape(root: string, shape: CagedShape): FretPosition[];
export function displayNote(note: string): string; // "B" -> "H", "A#3" -> "A#3"
```

- [ ] **Step 1: Write the failing tests**

```ts
const frets = (list: FretPosition[], s: number) => list.filter((p) => p.stringIndex === s).map((p) => p.fret).sort((a, b) => a - b);

expect(frets(pentatonicBox("A", 1), 0)).toEqual([5, 8]);
expect(frets(pentatonicBox("A", 1), 1)).toEqual([5, 7]);
expect(frets(pentatonicBox("A", 1), 4)).toEqual([5, 8]);
expect(frets(pentatonicBox("A", 3), 4)).toEqual([10, 13]);
expect(frets(pentatonicBox("E", 1), 0)).toEqual([0, 3]);
// Box 5 of A runs to fret 17, so it moves down an octave.
expect(frets(pentatonicBox("A", 5), 0)).toEqual([3, 5]);
expect(frets(pentatonicBox("A", 5), 2)).toEqual([2, 5]);

expect(cagedShape("C", "C")).toEqual([
  { stringIndex: 1, fret: 3 }, { stringIndex: 2, fret: 2 }, { stringIndex: 3, fret: 0 },
  { stringIndex: 4, fret: 1 }, { stringIndex: 5, fret: 0 },
]);
expect(cagedShape("C", "E").map((p) => p.fret)).toEqual([8, 10, 10, 9, 8, 8]);
expect(cagedShape("C", "D").map((p) => p.fret)).toEqual([10, 12, 13, 12]);
expect(cagedShape("A", "C").map((p) => p.fret)).toEqual([12, 11, 9, 10, 9]);

expect(displayNote("B")).toBe("H");
expect(displayNote("B3")).toBe("H3");
expect(displayNote("A#")).toBe("A#");
```

Plus two sweeps over all 12 `NOTES`, using `noteAt` in Standard tuning:

- `it("keeps every box on the drawn frets and in the scale")`: all five boxes, 12 positions each, `0 <= fret <= MAX_FRET`, every note `inScale(..., "moll-pentatonik")`.
- `it("builds every CAGED shape from major chord tones")`: every fret within the same limits, and every note an interval 0, 4 or 7 from the root.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/core/src/music/scales.test.ts`

- [ ] **Step 3: Implement with these exact tables**

Scale intervals: `dur [0,2,4,5,7,9,11]`, `moll [0,2,3,5,7,8,10]`, `moll-pentatonik [0,3,5,7,10]`.

Box offsets from `r`, the root's fret 0 to 11 on the low E string, low E to high e:

```ts
const BOXES = [
  [[0, 3], [0, 2], [0, 2], [0, 2], [0, 3], [0, 3]],
  [[3, 5], [2, 5], [2, 5], [2, 4], [3, 5], [3, 5]],
  [[5, 7], [5, 7], [5, 7], [4, 7], [5, 8], [5, 7]],
  [[7, 10], [7, 10], [7, 9], [7, 9], [8, 10], [7, 10]],
  [[10, 12], [10, 12], [9, 12], [9, 12], [10, 12], [10, 12]],
];
```

If the highest fret of a box passes `MAX_FRET`, subtract 12 from all of it.

CAGED: the root string and the offsets from the root fret `r`, per string low E to high e, `null` for unplayed:

```ts
const SHAPES = {
  C: { rootString: 1, offsets: [null, 0, -1, -3, -2, -3] },
  A: { rootString: 1, offsets: [null, 0, 2, 2, 2, 0] },
  G: { rootString: 0, offsets: [0, -1, -3, -3, -3, 0] },
  E: { rootString: 0, offsets: [0, 2, 2, 1, 0, 0] },
  D: { rootString: 2, offsets: [null, null, 0, 2, 3, 2] },
};
```

`r` is the root's first fret on the root string. If any resulting fret is negative, add 12 to `r`.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(music): add scales, pentatonic boxes and CAGED shapes`

---

### Task 5: Fretboard overlays, on the Tower and in quests

**Files:**
- Create: `skills/guitar/game/FretboardGrid.tsx`, `skills/guitar/game/FretOverlay.tsx`, `skills/guitar/game/FretOverlay.test.tsx`
- Modify: `skills/guitar/widgets/Fretboard.tsx`, `skills/guitar/game/Village.tsx`, `packages/core/src/game/quests.ts`, `skills/guitar/game/quests.json`, `skills/guitar/game/QuestView.tsx`, `skills/guitar/game/content.test.ts`
- Test: `skills/guitar/widgets/Fretboard.test.tsx`, `packages/core/src/game/quests.test.ts`

**Interfaces:**
- Consumes: Task 4.
- Produces:

```ts
export interface FretMark { label: string; state: "normal" | "dim" | "scale" | "root" }
FretboardGrid({ tuning, mark, onFret }: { tuning: Tuning; mark: (stringIndex: number, fret: number) => FretMark; onFret?: (stringIndex: number, fret: number) => void })
FretOverlay({ root, scale, box }: { root: string; scale: ScaleId; box?: 1 | 2 | 3 | 4 | 5 })
```

- `QuestDefinition.fretboard?: { root: string; scale: ScaleId; box?: number }`. Tasks 6, 7 and 11 add their own optional fields beside it.

The grid keeps `data-testid="fret-{s}-{f}"` and `data-in-scale`, and adds `data-root`. With `onFret` each cell is a button.

- [ ] **Step 1: Write the failing tests**

- `it("marks the A minor pentatonic")`: Anzeige "Moll-Pentatonik", Grundton A. `fret-0-5` has `data-root="true"`, `fret-0-8` is in scale, `fret-0-6` is not.
- `it("shows only the chosen box")`: Anzeige "Pentatonik-Box", Box 1, Grundton A. `fret-0-5` in scale, `fret-0-10` not.
- `it("shows a CAGED shape")`: Anzeige "CAGED", Form E, Grundton C. `fret-0-8` and `fret-2-10` in scale, `fret-2-9` not.
- `it("says boxes need the standard tuning")`: Stimmung Drop D with the box view shows "Boxen und CAGED gelten für die Standardstimmung." and marks nothing in scale.
- `it("names the note H in German")`: `fret-4-0` has text "H".
- Core: `it("rejects a quest with an unknown fretboard root")` through `parseGameContent`.
- Content: `it("gives the pentatonic and jam quests a fretboard")` for `pentatonik-box1` and `jam-em`.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run skills/guitar/widgets/Fretboard.test.tsx skills/guitar/game/FretOverlay.test.tsx packages/core/src/game/quests.test.ts`

- [ ] **Step 3: Extract the grid and add the new display modes to `Fretboard.tsx`**

Existing modes and their tests stay. New options: Moll-Tonleiter, Moll-Pentatonik, Pentatonik-Box, CAGED. The Box and Form selects appear only in their own mode. Roots are drawn stronger than scale tones. Note labels go through `displayNote`.

- [ ] **Step 4: Add `fretboard` to the quest schema and render `FretOverlay` in `QuestRun`**

Data: `pentatonik-box1` gets `{ root: "A", scale: "moll-pentatonik", box: 1 }`, matching lesson `11-pentatonik`. Read the lessons of `solo-drei-toene` and `jam-em`, and use the key and box they teach. Add no field where the lesson names no scale.

- [ ] **Step 5: In `Village.tsx` set the menu label to "Tower of CAGED" with hint "Griffbrett"**, matching the spec's place name. Fix any test or e2e selector that used the old label.

- [ ] **Step 6: Run `npx vitest run skills/guitar packages/core`, expect PASS**

- [ ] **Step 7: Commit** `feat(guitar): add scale, box and CAGED overlays`

---

### Task 6: Input picker, level meter and tuning link

**Files:**
- Create: `packages/core/src/audio/level.ts`, `packages/core/src/audio/level.test.ts`, `packages/web/src/audio/useInputDevices.ts`, `packages/web/src/audio/useInputDevices.test.ts`, `skills/guitar/game/InputControls.tsx`
- Modify: `packages/core/src/index.ts`, `packages/web/src/audio/useMicrophone.ts`, `skills/guitar/widgets/Tuner.tsx`, `skills/guitar/game/Places.tsx`, `skills/guitar/game/QuestView.tsx`, `packages/core/src/game/quests.ts`
- Test: `packages/web/src/audio/useMicrophone.test.ts`, `skills/guitar/widgets/Tuner.test.tsx`, `skills/guitar/game/QuestLoop.test.tsx`

**Interfaces:**
- `inputLevel(buffer: Float32Array): number`: 0 to 1, linear in dB from -60 to 0 dBFS.
- `useMicrophone({ onBuffer, fftSize, deviceId, onDeviceLost })`: `deviceId?: string | null`, `onDeviceLost?: () => void`.
- `useInputDevices()` returns `{ devices: { id: string; label: string }[]; deviceId: string | null; select: (id: string | null) => void; refresh: () => Promise<void> }`. The choice is stored per browser in `localStorage` key `audio.inputDevice`, since device ids mean nothing on another machine. Reads and writes are wrapped in try/catch.
- `InputControls({ devices, deviceId, onSelect, level })`, reused by Task 7.
- `Tuner` accepts `initialTuning?: string`. `QuestDefinition.tuning?: string`, checked against `TUNINGS` names in `contentSchema`.

- [ ] **Step 1: Write the failing tests**

- Core: silence gives 0, a full-scale sine gives more than 0.9, an amplitude of 0.001 gives less than 0.1, an empty buffer gives 0.
- `it("asks for the chosen device with processing off")`: `getUserMedia` receives `deviceId: { exact: "x" }` plus the three flags false.
- `it("falls back to the default device when the chosen one is gone")`: the first call rejects with `OverconstrainedError`, the second without `deviceId` succeeds. State is `running`, `onDeviceLost` was called once, `error` is "Das gewählte Eingabegerät ist nicht da. Das Standardgerät wird benutzt."
- `it("restarts on the new device while running")`.
- `it("keeps working when localStorage throws")` for `useInputDevices`.
- `it("lists devices without labels as Eingang 1")`: labels are empty until permission is given. `refresh` runs after the first successful start.
- Tuner: `it("opens with the tuning asked for")` and `it("falls back to Standard for an unknown tuning")`.
- Quest: `it("links a quest to its tuning in one click")` with a fixture quest `tuning: "Drop D"`: the link "Stimmung: Drop D" points to `/schrein?stimmung=Drop%20D&quest=<id>`. The Shrine shows "Zurück zur Quest", and the running timer survives through the stored start.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/web/src/audio packages/core/src/audio skills/guitar/widgets/Tuner.test.tsx`

- [ ] **Step 3: Implement**

Add `InputControls` to the Tuner. The meter is a `role="meter"` bar labelled "Eingangspegel". `Shrine` reads `stimmung` and `quest` with `useSearchParams`. No written quest needs Drop D yet, so the field stays unused in `quests.json` until stage 4.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(audio): add input picker, level meter and tuning link`

---

### Task 7: Note-finding game

**Files:**
- Create: `packages/core/src/game/noteFinder.ts`, `packages/core/src/game/noteFinder.test.ts`, `skills/guitar/game/NoteFinder.tsx`, `skills/guitar/game/NoteFinder.test.tsx`
- Modify: `packages/core/src/game/index.ts`, `packages/core/src/index.ts`, `packages/core/src/game/quests.ts`, `skills/guitar/game/quests.json`, `skills/guitar/game/Places.tsx`, `skills/guitar/game/QuestView.tsx`

**Interfaces:**
- Consumes: `FretboardGrid`, `InputControls`, `useMicrophone`, `useInputDevices`.
- Produces:

```ts
export interface NoteTarget { stringIndex: number; fret: number; note: string } // note with octave
export function nextTarget(strings: number[], previous: NoteTarget | null, tuning: Tuning, random?: () => number): NoteTarget;
export function matchesTarget(frequency: number, target: NoteTarget): boolean;
export function createHoldDetector(holdMs?: number): (matching: boolean, nowMs: number) => boolean;
NoteFinder({ strings, onResult }: { strings?: number[]; onResult?: (hits: number) => void })
```

- `QuestDefinition.noteGame?: { strings: number[] }`, each string 0 to 5.

- [ ] **Step 1: Write the failing core tests**

```ts
const f = { stringIndex: 1, fret: 8, note: "F3" };
expect(matchesTarget(frequencyOf("F3"), f)).toBe(true);
expect(matchesTarget(frequencyOf("F3") * 1.02, f)).toBe(true);   // about 34 cents
expect(matchesTarget(frequencyOf("F3") * 1.03, f)).toBe(false);  // about 51 cents
expect(matchesTarget(frequencyOf("F4"), f)).toBe(true);          // pitch detection may jump an octave
expect(matchesTarget(frequencyOf("F2"), f)).toBe(true);
expect(matchesTarget(frequencyOf("F#3"), f)).toBe(false);

const hold = createHoldDetector(200);
expect(hold(true, 0)).toBe(false);
expect(hold(true, 150)).toBe(false);
expect(hold(false, 160)).toBe(false); // a metronome click breaks the hold
expect(hold(true, 170)).toBe(false);
expect(hold(true, 380)).toBe(true);
```

`it("never repeats the pitch class of the previous target")`: 200 draws on `[0]`, a ringing string cannot score the next target. `it("stays on the chosen strings and frets 0 to 12")`.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/core/src/game/noteFinder.test.ts`

- [ ] **Step 3: Implement.** Tolerance is 40 cents, against the target and one octave either way. Hold default is 200 ms.

- [ ] **Step 4: Write the failing component tests**

- `it("scores a click on the right fret")`: with `random` fixed through a mocked `Math.random`, start the round, click the target cell, the counter reads "Treffer: 1" and the target changes.
- `it("shows the right place after a wrong click")`, without a point.
- `it("hides note names during the round")`: no cell shows a note label.
- `it("offers the click mode when the microphone is denied")`: the mic error is shown and clicks still score.
- `it("ends after 60 seconds and logs free time")`: without `onResult`, `gameApi.log` gets `{ kind: "frei", seconds: 60, level: 1, techniqueId: "theorie", metricKey: "notenfinder:0", metricValue: 3 }`.
- `it("hands the result to the quest")`: with `onResult`, nothing is logged.
- `it("releases the microphone when the round ends")`.

- [ ] **Step 5: Implement `NoteFinder`, following the phases of `ChordTrainer`**

Prompt: "Finde F auf der A-Saite", through `displayNote`, in German string names E, A, D, G, H, e. Click mode is the default, and "Mit Gitarre spielen" turns on the microphone. Strings select on the Tower: E-Saite, A-Saite, E und A, Alle. The Tower shows it under the fretboard.

- [ ] **Step 6: Connect the quest**

`noten-e-saite` gets `noteGame: { strings: [0] }` and `metricLabel: "Treffer pro Minute"`. `QuestRun` renders `NoteFinder` and passes hits to the same best-round state the chord trainer uses. Check that the quest description still reads right, and adjust it in German if not.

- [ ] **Step 7: Run `npx vitest run skills/guitar packages/core`, expect PASS**

- [ ] **Step 8: Commit** `feat(guitar): add note-finding game with click fallback`

---

### Task 8: Tavern song data: stars, last played, technique tags

**Files:**
- Modify: `packages/server/src/db/client.ts`, `packages/server/src/routes/game.ts`, `packages/server/src/routes/songs.ts`, `packages/core/src/game/api-types.ts`, `packages/core/src/index.ts`, `skills/guitar/game/api.ts`, `skills/guitar/widgets/SongLibrary.tsx`
- Create: `skills/guitar/widgets/SongLibrary.test.tsx`
- Test: `packages/server/src/routes/game.test.ts`, `packages/server/src/routes/songs.test.ts`

**Interfaces:**

```ts
export interface SongMeta { stars: number; lastPlayedAt: number | null; tags: string[] }
```

Table, in the DDL only like the other game tables:

```sql
CREATE TABLE IF NOT EXISTS game_songs (skill_id TEXT NOT NULL, song_key TEXT NOT NULL, stars INTEGER NOT NULL DEFAULT 0, last_played INTEGER, tags_json TEXT NOT NULL DEFAULT '[]', PRIMARY KEY (skill_id, song_key));
```

- `GET /api/game/:skillId/songs` returns `{ songs: Record<string, SongMeta> }`.
- `PUT /api/game/:skillId/song/:songKey` takes `{ stars?: 0..5; tags?: string[]; played?: true }`, changes only the given fields, and rejects keys not matching `^(uebung|song):.+$`.
- `gameApi.songMeta()` and `gameApi.setSongMeta(key, patch)`.
- `song_key` uses the same form as chord overrides, `song:12` and `uebung:x`, not the target song's `db:12`.

- [ ] **Step 1: Write the failing server tests**

- `it("keeps stars when only played is sent")`, `it("stores tags and stars per song")`, `it("rejects six stars")`, `it("rejects an unknown key form")`, `it("returns an empty map for a new skill")`.
- songs route: `it("removes the song's meta with the song")`, leaving other rows and `songs` content alone.

- [ ] **Step 2: Run, expect FAIL**, then implement them. Upsert with `ON CONFLICT`. `played` writes `Date.now()`.

- [ ] **Step 3: Write the failing UI tests**

- `it("marks a song played when opened")`: the PUT with `played: true`.
- `it("shows stars and last played on the song card")`: "★★★☆☆" with an accessible name "3 von 5 Sternen", and "Zuletzt gespielt: heute".
- `it("sets stars in the open song")`: a group "Beherrschung", the button "4 Sterne" writes `stars: 4`.
- `it("filters by technique")`: a select "Technik" with `gameContent.techniques` hides untagged songs in both lists.
- `it("shows the songs when the meta request fails")`: cards render without stars, and a failed star write shows a German `role="alert"`.

- [ ] **Step 4: Implement in `SongLibrary`**

Open-song tools live above `SongView`, so `SongView` stays free of game calls. Tags are checkboxes in a `<details>` "Techniken". "Zuletzt gespielt" reads heute, gestern, vor N Tagen, or nothing for never, by local day.

- [ ] **Step 5: Run `npx vitest run packages/server skills/guitar/widgets`, expect PASS**

- [ ] **Step 6: Commit** `feat(tavern): add mastery stars, last played and technique tags`

---

### Task 9: Auto-scroll and section loop

**Files:**
- Create: `packages/web/src/features/songs/autoScroll.ts`, `packages/web/src/features/songs/autoScroll.test.ts`
- Modify: `packages/web/src/features/songs/SongView.tsx`
- Test: `packages/web/src/features/songs/SongView.test.tsx`

**Interfaces:**

```ts
export interface ScrollRange { start: number; end: number; viewport: number; loop: boolean }
export function nextScrollTop(current: number, step: number, range: ScrollRange): { top: number; done: boolean };
```

- [ ] **Step 1: Write the failing tests**

```ts
const song = { start: 0, end: 1000, viewport: 400, loop: false };
expect(nextScrollTop(100, 1, song)).toEqual({ top: 101, done: false });
expect(nextScrollTop(600, 1, song)).toEqual({ top: 600, done: true }); // end of the song stops
const part = { start: 300, end: 900, viewport: 400, loop: true };
expect(nextScrollTop(100, 1, part)).toEqual({ top: 300, done: false }); // outside jumps in
expect(nextScrollTop(499, 1, part)).toEqual({ top: 500, done: false });
expect(nextScrollTop(500, 1, part)).toEqual({ top: 300, done: false }); // wraps
const short = { start: 300, end: 500, viewport: 400, loop: true };
expect(nextScrollTop(300, 1, short)).toEqual({ top: 300, done: false }); // fits the window, holds still
```

SongView:

- `it("loops the section chosen by position when two share a name")`: a song with two "Strophe" sections lists "1. Strophe" and "2. Strophe" in the select "Abschnitt wiederholen", and the second maps to section index 1.
- `it("stops the auto-scroll at the end of the song")`: the button returns to "Auto-Scroll starten".
- `it("keeps working without sections")`: the select is absent for a song with one section.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/web/src/features/songs`

- [ ] **Step 3: Implement**

Measure section offsets from refs relative to the container at each tick, so transposing or resizing cannot leave stale numbers. Setting a loop starts at the section. Choosing "Ganzer Song" returns to normal. The import preview also renders `SongView`, and it gets the same controls.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(songs): add section loop and stop auto-scroll at the end`

---

### Task 10: Chronicle graphs

**Load the `dataviz` skill before writing chart code.**

**Files:**
- Create: `packages/core/src/game/chronicle.ts`, `packages/core/src/game/chronicle.test.ts`, `skills/guitar/game/chronicle/Chronicle.tsx`, `skills/guitar/game/chronicle/LineChart.tsx`, `skills/guitar/game/chronicle/MinutesBars.tsx`, `skills/guitar/game/chronicle/Chronicle.test.tsx`
- Modify: `packages/core/src/game/index.ts`, `packages/core/src/game/api-types.ts`, `packages/core/src/index.ts`, `packages/server/src/routes/game.ts`, `skills/guitar/game/api.ts`, `skills/guitar/game/Places.tsx` (remove `Chronicle`, `Records`, `recordLabel`), `skills/guitar/widgets/GameApp.tsx`
- Test: `packages/server/src/routes/game.test.ts`

**Interfaces:**

```ts
export interface History {
  days: { day: string; seconds: number }[];
  metrics: { key: string; day: string; value: number }[]; // best value per key and day
}
export function weeklyMinutes(days: History["days"], today: string, weeks?: number): { weekStart: string; minutes: number }[];
export type MetricGroup = "wechsel" | "bpm" | "noten" | "andere";
export function metricGroup(key: string, quests: QuestDefinition[]): MetricGroup;
export function metricSeries(metrics: History["metrics"], key: string): { day: string; value: number }[];
```

`GET /api/game/:skillId/history` returns `History`. `gameApi.history()`, query key `["game", "guitar", "history"]`.

- [ ] **Step 1: Write the failing tests**

- `weeklyMinutes`: default 12 weeks, oldest first, weeks without play are 0, seconds round to minutes, a day before the window is ignored.
- `metricGroup`: `wechsel:Am-C` is `wechsel`, a quest whose `metricLabel` holds "BPM" is `bpm`, `notenfinder:0` and a quest with `noteGame` are `noten`, an unknown key is `andere`.
- `metricSeries` sorts by day and does not invent days.
- Server: `it("keeps the best metric per key and day")` with two logs on one day, and `it("sums the seconds per day")`.
- UI: `it("draws one line per chosen pair")`, a select "Wechsel" lists pairs, the chart has `role="img"` and a name such as "Wechsel Am–C, zuletzt 34". `it("shows a single result as a point")`. `it("says so when nothing is measured yet")`, "Noch keine Messwerte". `it("shows an error with retry when the history fails")`, not zeros. `it("shows nothing false while loading")`. This closes the stage 1 item on false Chronicle data.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/core/src/game/chronicle.test.ts packages/server/src/routes/game.test.ts skills/guitar/game/chronicle`

- [ ] **Step 3: Implement the rules, the route and the screen**

Sections, top to bottom: Wechsel pro Minute, Sauberes Tempo, Noten finden (only with data), Minuten pro Woche, then the existing totals, Rekorde and "Einstufung wiederholen". Charts are hand SVG, with a time axis scaled by real days so gaps stay honest. The chart colours are fixed, since the game keeps its own look in any app theme.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(chronicle): add graphs for changes, tempo and minutes`

---

### Task 11: Riff viewer

**Files:**
- Create: `skills/guitar/game/riffs.json`, `skills/guitar/game/RiffViewer.tsx`, `skills/guitar/game/RiffViewer.test.tsx`
- Modify: `packages/core/src/game/quests.ts`, `skills/guitar/game/api.ts`, `skills/guitar/game/quests.json`, `skills/guitar/game/QuestView.tsx`, `skills/guitar/game/Village.tsx`, `skills/guitar/widgets/GameApp.tsx`, `skills/guitar/game/content.test.ts`
- Test: `packages/core/src/game/quests.test.ts`

**Interfaces:**
- Consumes: `Tab` from `visuals`, `MetronomePanel`.

```ts
// In baseSchema, default []. tuning is optional, zeilen holds six strings of equal length.
riffs: { id: string; title: string; description: string; lessonId: string; bpm: number; tuning?: string; zeilen: string[] }[]
// QuestDefinition.riffId?: string
RiffCard({ riff, onTempo }: { riff: Riff; onTempo: (bpm: number) => void })
Riffs()  // the page, route "riffs"
```

- [ ] **Step 1: Write the failing tests**

- Core: unknown `riffId` and unknown riff `lessonId` fail in `parseGameContent`. Lines of unequal length, or not six lines, fail.
- Content: `it("takes every riff from its lesson")`: each `zeilen` line appears verbatim in the riff's `.mdx` file, which keeps "all riffs original" true without new composing.
- UI: `it("sets the metronome to the riff's tempo")`. `it("links to the lesson")`. `it("shows the riff inside its quest")` for `erstes-riff`. `it("links a riff in another tuning to the Shrine")`.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run skills/guitar/game/RiffViewer.test.tsx skills/guitar/game/content.test.ts packages/core/src/game/quests.test.ts`

- [ ] **Step 3: Implement, then fill `riffs.json`**

Copy one tab each out of `09-powerchords`, `metal-palm-mute`, `metal-erster-riff`, `metal-downpicking`, `jam-ein-akkord` and `lead-drei-toene`, with the tempo the lesson names. Set `riffId` on `erstes-riff`, `palm-mute-akzente` and `downpicking-ausdauer`, where the tab is the one the quest practises. The menu gets `{ path: "riffs", label: "Riffs", hint: "Tabs zum Üben", sprite: "shield" }`.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(guitar): add riff viewer`

---

### Task 12: Jam patterns

**Files:**
- Create: `packages/core/src/music/jam.ts`, `packages/core/src/music/jam.test.ts`
- Modify: `packages/core/src/music/index.ts`

**Interfaces:**

```ts
export type JamStyle = "rock" | "metal" | "blues";
export const JAM_STYLES: Record<JamStyle, { label: string; scale: ScaleId; stepsPerBar: number; progression: number[] }>;
export interface JamSettings { root: string; style: JamStyle }
export interface JamHit { step: number; voice: "kick" | "snare" | "hat" | "bass"; midi?: number }
export function jamBar(settings: JamSettings, barIndex: number): JamHit[];
export function jamChord(settings: JamSettings, barIndex: number): string;
```

- [ ] **Step 1: Write the failing tests**

```ts
const chords = (style: JamStyle, root: string, n: number) => Array.from({ length: n }, (_, i) => jamChord({ root, style }, i));
expect(chords("rock", "A", 4)).toEqual(["Am", "F", "C", "G"]);
expect(chords("metal", "E", 4)).toEqual(["E5", "E5", "C5", "D5"]);
expect(chords("blues", "A", 12)).toEqual(["A7","A7","A7","A7","D7","D7","A7","A7","E7","D7","A7","A7"]);
expect(jamChord({ root: "A", style: "rock" }, 4)).toBe("Am"); // repeats
expect(JAM_STYLES.metal.scale).toBe("moll");
expect(JAM_STYLES.blues.stepsPerBar).toBe(12);
```

For all styles and 12 roots, over 12 bars: a kick and a bass hit on step 0, every step below `stepsPerBar`, snare on beats 2 and 4, bass `midi` within 28 to 39, the bass at step 0 has the chord's pitch class. Blues hats fall only on shuffle steps, `step % 3 !== 1`. Metal has gallop bass hits, at least 8 per bar.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/core/src/music/jam.test.ts`

- [ ] **Step 3: Implement**

Progressions, in semitones from the root: rock `[0, 8, 3, 10]` at 16 steps, scale `moll-pentatonik`. Metal `[0, 0, 8, 10]` at 16 steps, scale `moll`. Blues `[0,0,0,0,5,5,0,0,7,5,0,0]` at 12 steps, scale `moll-pentatonik`. Rock chords: minor on offset 0, major elsewhere. Metal: power chords. Blues: dominant sevens. Bass midi: `28 + ((pitchClass - 4 + 12) % 12)`. Chord names use `semitoneToNote`, sharps as in `NOTES`.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit** `feat(music): add generated jam patterns`

---

### Task 13: Jam Room

**Files:**
- Create: `skills/guitar/game/jam/useJamEngine.ts`, `skills/guitar/game/jam/useJamEngine.test.ts`, `skills/guitar/game/jam/JamRoom.tsx`, `skills/guitar/game/jam/JamRoom.test.tsx`
- Modify: `skills/guitar/game/Village.tsx`, `skills/guitar/widgets/GameApp.tsx`, `skills/guitar/game/game.css`

**Interfaces:**
- Consumes: `startLookahead`, `jamBar`, `jamChord`, `JAM_STYLES`, `FretOverlay`, `gameApi.log`.
- Produces: `useJamEngine({ root, style, bpm, volume })` returning `{ running, start, stop, chord, nextChord }`. Route `jam`, menu `{ path: "jam", label: "Jam Room", hint: "Begleitung", sprite: "potion" }`.

Step length is `60 / bpm / (stepsPerBar / 4)`. Tempo range 50 to 220, default 90. Default key E, style Rock.

- [ ] **Step 1: Write the failing engine tests**, with the `AudioContext` stub of `useMetronome.test.ts` extended by `createBuffer`, `createBufferSource` and `createBiquadFilter`.

- `it("schedules a bar's hits")`.
- `it("applies a new style at the next bar, not mid-bar")`.
- `it("closes the audio context on stop and on unmount")`.
- `it("logs the time once on stop")`: after 90 s, `gameApi.log` gets `{ kind: "frei", seconds: 90, level: 1, techniqueId: "jam" }`, and a following unmount logs nothing.
- `it("logs on unmount while playing")`, also inside `<StrictMode>`.
- `it("logs nothing under one minute")`.
- `it("stops by itself after an hour and logs 3600 seconds")`, so a forgotten backing track earns no more.
- `it("survives a failed log")`: audio still stops.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run skills/guitar/game/jam`

- [ ] **Step 3: Implement the engine**

Voices: kick is a sine dropping from 150 to 50 Hz, snare and hat are noise bursts through band-pass and high-pass filters, bass is a sawtooth through a low-pass at about 800 Hz. One master gain follows `volume`.

- [ ] **Step 4: Write the failing screen tests**

- `it("shows the matching scale on the fretboard")`: Tonart A, Stil Metal shows the A natural minor overlay.
- `it("narrows the scale to a box")`: a select "Box" with Ganze Tonleiter and 1 to 5, offered only for pentatonic styles.
- `it("shows the current and next chord while playing")`.
- `it("keeps playing when the key changes")`: the scale overlay updates too.
- `it("says an unsupported browser cannot play")` without `AudioContext`, in German, with no crash.

- [ ] **Step 5: Implement `JamRoom`.** Add it to the village as a sign on the painting only if it fits without covering another, otherwise in the menu.

- [ ] **Step 6: Run `npx vitest run skills/guitar`, expect PASS**

- [ ] **Step 7: Listen.** Start `npm run dev`, open the Jam Room in each style, and check by ear that nothing clips and the bass is audible. If you cannot listen, record that this check is open for the owner. Stop the dev server.

- [ ] **Step 8: Commit** `feat(guitar): add Jam Room with generated drums and bass`

---

### Task 14: Phone layout and home-network start

**Files:**
- Create: `packages/server/src/devLan.ts`, `packages/server/src/devLan.test.ts`, `e2e/guitar-phone.spec.ts`
- Modify: `package.json`, `skills/guitar/game/game.css`, `skills/guitar/game/map/map.css` where needed, `README.md`

**Interfaces:**
- `lanUrls(interfaces: NodeJS.Dict<os.NetworkInterfaceInfo[]>, port: number): string[]`: non-internal IPv4 only.
- Root script: `"dev:lan": "tsx packages/server/src/devLan.ts"`.

The API server stays on `127.0.0.1`. Only Vite listens on the network and proxies `/api`, so `npm run dev` and `main.ts` do not change.

- [ ] **Step 1: Write the failing tests**

`lanUrls`: skips internal and IPv6, returns `http://192.168.1.20:5173`, and returns `[]` without a network. Importing `devLan.ts` must start nothing, so guard the start with a main-module check.

`e2e/guitar-phone.spec.ts` at viewport 390 x 844, after placement as in `guitar-game.spec.ts`:

- `test("no page scrolls sideways")` for the village, `quests`, `taverne`, `bibliothek`, `chronik`, `griffbrett`, `jam`, `riffs`: `document.documentElement.scrollWidth <= window.innerWidth`.
- `test("the status bar shows level, streak and week time")`.
- `test("today's quests come first and the painting stays away")` on the village.
- `test("a quest starts in one tap")`.

- [ ] **Step 2: Run, expect FAIL**, with `npx vitest run packages/server/src/devLan.test.ts && npx playwright test e2e/guitar-phone.spec.ts`

- [ ] **Step 3: Implement `devLan.ts`**

It spawns `npm run dev -w @skills/server` and `npm run dev -w @skills/web -- --host 0.0.0.0`, stops both together, and prints the URLs plus this warning:

```
Achtung: Die App hat keine Anmeldung. Jeder in diesem Netzwerk kann sie öffnen, deine Daten ändern und deine Sicherung herunterladen. Nutze das nur im eigenen Heimnetz und beende es mit Strg+C.
```

- [ ] **Step 4: Fix the layout in CSS until the phone e2e passes.** Hide the village painting below 640 px. Wide content scrolls inside its own box.

- [ ] **Step 5: Check it for real**

Run `npm run dev:lan`, then from this machine open `http://<lan-ip>:5173/vollbild/guitar/spiel` with curl, and `curl http://<lan-ip>:5173/api/songs` for a 200. Check `curl http://<lan-ip>:5174/api/songs` is refused, proving the API itself is not exposed. Stop it.

- [ ] **Step 6: Add `npm run dev:lan` to the README command table,** with the warning in one sentence.

- [ ] **Step 7: Commit** `feat(app): add phone layout pass and opt-in home-network start`

---

### Task 15: End-to-end run and stage close

**Files:**
- Create: `e2e/guitar-tools.spec.ts`
- Modify: `PROJECT_LOG.md`, `README.md` if a command or tool list changed

- [ ] **Step 1: Write the e2e tests**

Reuse the placement steps of `guitar-game.spec.ts`. No test may need a microphone.

- `test("Metronom: Galopp und Tempotrainer lassen sich in einer Quest einstellen")`.
- `test("Griffbrett: Box 1 in A zeigt Bund 5 und 8")`.
- `test("Notenfinder: ein Klick auf den richtigen Bund zählt")`, finding the cell from the prompt.
- `test("Taverne: Sterne bleiben nach dem Neuladen")`.
- `test("Chronik: ein Wechsel-Ergebnis erscheint im Graphen")`, closing the stage 1 note about the missing week-time assertion by also checking the week minutes.
- `test("Jam Room: Start und Stopp, Tonleiter passt zur Tonart")`.
- `test("Riffs: Tab sichtbar, Tempo geht ans Metronom")`.

- [ ] **Step 2: Run everything, with `npm run dev` stopped**

Run: `npm test && npm run typecheck && npm run build && npm run test:e2e`
Expected: all pass. Fix causes, not tests.

- [ ] **Step 3: Update `PROJECT_LOG.md`**

Record the decisions of this stage in the file's German style: `game_songs` and its key form, riffs copied from lessons, time logging limits of the Jam Room, the network start exposing only Vite. Change "Offen" to stages 4 and 5.

- [ ] **Step 4: Commit** `test(guitar): cover the stage 3 tools end to end`

---

## Builder's calls in this plan

The spec leaves these open. Change them if a better option appears.

- "Last played" means the song was opened.
- Riffs get their own place, `riffs`, since the spec names no place for them.
- The riff viewer shows tab and sets the tempo. It has no moving cursor and no audio.
- Jam Room time counts only from one minute on, and playback stops itself after an hour.
- Note finding accepts the same pitch on another string, and one octave off, since audio cannot tell them apart reliably.
- Jam styles are rock, metal and blues.
