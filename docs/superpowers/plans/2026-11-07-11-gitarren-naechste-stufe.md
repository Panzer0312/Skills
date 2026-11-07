# Guitar RPG — next level: 5-phase roadmap

> **For agentic workers:** this is a phase roadmap, not a step-by-step plan. At the start of each phase, write that phase's own TDD plan with superpowers:writing-plans **against the real code at that moment** (house rule: every stage gets its own plan). Then run it with superpowers:subagent-driven-development. The parallel and complexity notes below exist so you can dispatch as many workers at once as the files allow.

**Goal:** Move the guitar RPG from "guided practice with tools" to "a coach that knows where you stall". Five phases:
1. Rough edges, a settings core, an optional-device layer and a skippable intro.
2. Song mastery (section tempo ladders, optional self-recording, lesson feedback).
3. Guidance (weekly review with plateau detection, spaced repetition, ear training).
4. Jam Room 2.0, a richer metronome and an optional rhythm meter.
5. Atmosphere, deep customisation and offline use.

**Out of scope:** Bluetooth page-turner pedal support (idea 4 of the 2026-11-07 list). Remapping shortcut keys is out too, because it overlaps the pedal idea.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md`. The amendments below come from the owner's request of 2026-11-07.

**State at start:** master at `9b610ea` or later. 1461 vitest tests and 2 QOL e2e tests pass. The previous pass is `docs/superpowers/plans/2026-11-07-10-gitarren-qol.md`.

---

## Spec amendments (owner request, 2026-11-07)

1. **Optional rhythm judging.** The non-goal "no automatic judging from audio except note finding" is relaxed: an **opt-in** rhythm meter may compare onsets to the metronome (Phase 4). It shows timing only. It never awards or withholds XP, never blocks progress and never shames. Results stay self-reported as before; the meter value can only *prefill* a field.
2. **Optional self-recording.** Recordings are allowed. They are opt-in, stay on the local machine, can be deleted at any time, and the user chooses how long they are kept.
3. **Customisable everything.** Every new behaviour gets a setting with a sensible default. The default experience must equal today's behaviour, except where a rough edge is fixed.

## Global constraints (bind every phase)

- All UI text in German. Region and place names may stay English. Use straight quotes, as in the code.
- **Anti-goals still bind:**
  - no guilt mechanics;
  - no XP for doing nothing;
  - sound must not interfere with practice;
  - no more clicking than playing;
  - no hard walls.
- **Devices are optional.** Any feature that needs a guitar input, microphone, audio interface or speakers must:
  - (a) be off or hidden by default when no device is confirmed;
  - (b) have a full no-device path (click fallback, manual number entry, or the feature simply absent);
  - (c) never block a quest, a lesson, the road or a reward;
  - (d) run in tests with mocks only, so no task waits on hardware.
- `localStorage` and IndexedDB access always go inside try/catch with fallbacks. Shared hooks in `packages/web/src/app/` never import from `skills/`.
- **Server schema.** `client.ts` has only `CREATE TABLE IF NOT EXISTS` and no migrations. New data goes into **new tables**. If a column is unavoidable, Phase 1 Task 1.2 adds an `ensureColumn(table, column, ddl)` helper; use only that.
- **Sound.** Every new sound source routes through the Phase 1 mixer channels (`ambience`, `effects`, `metronome`, `jam`, `ear`) once they exist.
- Every new task runs TDD. `npm test` and `npm run typecheck` must be green before each commit. Stop `npm run dev` before e2e. The e2e DB is `data/e2e.db`.
- Commits go on master, one or more per task, ending with the attribution line from the session reminder.

## How to parallelise (read before dispatching)

**Proven pattern from the previous pass:** several implementers in one checkout on master. Each commits only its own files with `git add <paths> && git commit -m … -- <paths>`, and never uses `git add -A`, stash or reset. The full suite may fail on another agent's half-done work; workers note it and do not fix it. Only run the full suite while no implementer is active.

**Hotspot files** (touched by many features). Use these strategies:

| File | Risk | Strategy |
|---|---|---|
| `packages/server/src/routes/game.ts` (≈550 lines) | every server feature | **Phase 1 Task 1.2 splits it** into `routes/game/*.ts` by feature (log, settings, songs, review, cards, recordings). Later tasks each add their **own** route file and one line in `routes/game/index.ts`. |
| `packages/server/src/db/client.ts` schema string | every new table | Each feature appends its own `CREATE TABLE` block at the end, separated by a comment line naming the feature. Merge conflicts are trivial; resolve them by keeping both. |
| `skills/guitar/game/api.ts` | every client call | Phase 1 Task 1.2 moves feature calls into `game/api/<feature>.ts`, with `api.ts` re-exporting. New features add their own file. |
| `skills/guitar/game/quests.json` / `map.json` | content | Use the content staging pattern from stage 4. Each batch writes into a git-ignored `staging/<batch>.json` with its own **order/id range**, and one merge script folds the batches in. Assign the ranges up front: they collided once before. |
| `skills/guitar/game/game.css` | every UI | Append-only, one block per feature under `/* <feature> */`. New components prefer a co-located `<feature>.css` like `market.css`. |
| `QuestView.tsx` | quests with new tools | Add new tools through a **quest tool registry** (Phase 1 Task 1.3: `questTools.ts` maps a quest field to a component). Then later tasks register tools without editing QuestView. |
| `GameApp.tsx` routes, `Village.tsx` hotspots | new places | Use one route and hotspot registry file, `places.ts` (Phase 1 Task 1.3). New places add an entry. |

**Complexity scale** (it drives the model choice):
- **S:** 1–2 files, clear spec. Cheapest model.
- **M:** 2–5 files, some integration. Mid model.
- **L:** new subsystem or cross-cutting. Mid model with a capable reviewer.
- **XL:** signal processing or a design call. Most capable model.

Reviews take a mid model at least. The final review of each phase takes the most capable model.

**Legend in task tables:** `∥A` means parallel group A; all tasks in one group can run at once. `→ x.y` means it must wait for task x.y.

---

## Phase 1 — Foundation: rough edges, settings, devices, intro

**Why first:** every later phase consumes the settings store, the device layer and the registries. The rough edges are cheap and visible.

| ID | Task | Complexity | Group / deps |
|---|---|---|---|
| 1.1a | **Rough edges: trainer and quest keys.** `ChordTrainer` and `NoteFinder` report `onRunningChange(running)`. QuestView turns quest keys off while a round runs; Enter must never end a quest mid-round. In-quest `p` also cancels a running trainer round, with a confirmation. | S | ∥A |
| 1.1b | **Rough edges: gold.** The wallet shows `earned - spent` honestly. When an undo would push it below 0, the undo dialog says "Du hast schon N Gold ausgegeben. Das Gold bleibt, du startest bei 0." Server side, gold becomes `max(0, …)` **and the debt is forgiven**: store a `game_gold_adjust` row, so no hidden debt eats future gold. No guilt. | M | ∥A |
| 1.1c | **Rough edges: forgotten timer.** In FreePractice, if the elapsed time is > 90 min, stopping shows an editable minutes field (prefilled, max 240) before saving. The 90 min threshold becomes a setting in 1.2. | S | ∥A |
| 1.1d | **Rough edges: log window.** `GET /log/recent?since=<ms>` returns all entries since a time, capped at 500. FreePractice uses it, which removes the cap-20 under-subtraction. | S | ∥A |
| 1.1e | **Rough edges: calendar access.** The Chronicle calendar becomes a `role="grid"` with weekday and month labels and roving tabindex, so arrow keys move between days. The tooltip shows on focus. | M | ∥A |
| 1.1f | **Rough edges: deferred-minor batch** (one dispatch; the list is in the git log of the QOL pass and in the memory note): wake-lock visibilitychange double request; `Object.hasOwn` in keys; NoteFinder nested ternary and dead `setLevel(0)`; export filename uses skillId; `Number("1e0")` id; JamRoom box persistence test; metronome step-clamp tests. | S | ∥A |
| 1.2 | **Settings core and server split.** Split `routes/game.ts` into `routes/game/*` and `api.ts` into `api/*`, with no behaviour change; that step lands first, in its own commit. Add `ensureColumn`. New table `game_prefs(skill_id, key, value_json)`; routes `GET/PUT /api/game/:skill/prefs` take a zod-validated **typed registry** in core (`packages/core/src/game/prefs.ts`: `PREFS = { key: { schema, default, label, group } }`). Client hook `usePref(key)`. **Migrate** the `sound` boolean and the localStorage tool settings (`guitar.metronome`, `guitar.jam`, `guitar.tuner.tuning`, `guitar.notefinder.tuning`, `guitar.trainer.customPair`) into prefs, reading the old keys once. | L | **serial first**, before everything in ∥B |
| 1.3 | **Registries.** `places.ts` registers routes, hotspots and menu entries. `questTools.ts` maps a quest field to its tool component. QuestView and Village render from them; no visible change. | M | → 1.2 (it touches api); ∥B |
| 1.4 | **Optional device layer.** `useDevices()` exposes `{ mic: "unknown" \| "denied" \| "ok", output: "ok", guitarConnected: pref }`. Pref `geraete.gitarreAmMikro`: "Ja / Nein / Später fragen", default "Später fragen". The Shrine gets a short device check: test the mic level, optionally test an audio interface, and confirm. Any component asks `canUse("mic")` and falls back when it can't. | M | → 1.2; ∥B |
| 1.5 | **Settings screen.** A new place "Studierstube" (village hotspot plus a status-bar gear icon) with one tab per group: Allgemein, Klang, Üben, Geräte, Darstellung, Mentor, Daten. It is built from the `PREFS` registry, so later tasks only add registry entries and the UI appears by itself. Includes "Alles zurücksetzen" and "Intro erneut ansehen". | M | → 1.2, 1.3; ∥B |
| 1.6 | **Skippable intro tour.** Shown on first launch, **before** Placement. One "Überspringen" button is always visible, Esc skips, and it never comes back unless replayed from the Studierstube. Content: 6–9 short steps told by mentor Meister Orlo, about 2 lines each, covering the village, Quest Board, map, tools, Frei üben, Chronicle and Studierstube. A spotlight highlights the real hotspot. Its state lives in the pref `intro.gesehen`. Also: a per-place "?" button that replays only that place's step. Text goes in `skills/guitar/game/intro.json` and is validated by a content test. | M | → 1.3 (hotspot ids), 1.5 (replay button); ∥C |
| 1.7 | e2e: skip intro, replay intro, change one pref and see the effect, device "Nein" hides the mic buttons. Docs: README, and a new user-facing `skills/guitar/reference/einstellungen.mdx`. | S | → all |

**Parallel plan for Phase 1:**
1. Wave 1: 1.1a–f (six workers, disjoint files) **and** 1.2 together. 1.2 touches `game.ts`/`api.ts` and 1.1b/1.1d touch those too, so run 1.1b and 1.1d **after** 1.2's split commit lands; they then edit the new split files.
2. Wave 2: 1.3, 1.4 and 1.5.
3. Wave 3: 1.6.
4. Wave 4: 1.7.

**Owner checks:** read the intro text and its tone, try the device check with your real guitar, and decide whether the Studierstube needs more knobs.

---

## Phase 2 — Mastering songs

**Why:** this is the owner's oldest pain: songs stall after the intro, as with The Bard's Song.

| ID | Task | Complexity | Group / deps |
|---|---|---|---|
| 2.1 | **Core model for section ladders.** `packages/core/src/game/songLadder.ts` defines per song section: `steps` (default tempo percents `[60, 70, 80, 90, 100]`, set in prefs), `cleanStreakNeeded` (default 3 clean runs per step, in prefs), `current`, `best`. Pure functions: `nextStep`, `recordRun(clean: boolean)`, `songProgress`. The tempo base is the song's BPM if known, else a user-set BPM per song. | M | ∥A |
| 2.2 | **Server and storage.** Table `game_song_sections(skill_id, song_key, section_index, state_json, updated_at)`. Routes live in `routes/game/songs.ts`: `GET/PUT /api/game/:skill/song/:key/sections`. The song's base BPM sits in the same table, at section −1, or in its own table. | M | ∥A (its own route file) |
| 2.3 | **Song view ladder UI.** Each section shows a step chip ("70 % · 2/3 sauber") and a button "Durchlauf: sauber / nicht sauber". Choosing a section sets the loop and the metronome to the step tempo and starts the count-in. Hands-free option: Space marks a clean run (via `usePracticeKeys`). SongView stays free of game calls, so the ladder arrives through an optional `practice` prop that the guitar Tavern wrapper injects. | L | → 2.1; ∥B |
| 2.4 | **Quest kind `song-stufe`.** The quest generator picks "your next section at your next step" for the target song and the chosen song lessons. It scales by personal level (more runs, higher step). Its tool goes into the `questTools` registry. Content batch: new quest definitions in the staging id range **Q-2000–2099**. | M | → 2.1, 1.3; ∥B |
| 2.5 | **Progress views.** The Tavern shows a per-song progress bar and its sections. The Chronicle gets a "Songs" section with a stacked bar per song. The map's song nodes show a ladder badge. | M | → 2.1, 2.2; ∥B |
| 2.6 | **Optional self-recording.** Only shown when `canUse("mic")` and the pref `aufnahme.aktiv` is on (default off). Recording uses MediaRecorder (webm/opus) with 30/60/120 s limits. Recordings are stored **server-local** in `data/recordings/<id>.webm`, with table `game_recordings(id, skill_id, at, quest_id, song_key, section_index, seconds, path)` and routes in `routes/game/recordings.ts` (upload with a size cap of 10 MB, list, stream, delete). The record button appears in quests, the song view and Frei üben, and works without the button anywhere else. A "Vorher / Nachher" panel in the Chronicle plays the oldest and newest recording of the same quest or section side by side. Retention pref: "Für immer / 90 Tage / 30 Tage", default 90. Tests: MediaRecorder and fetch mocks only. **No device needed to finish the task.** | L | → 1.4; ∥B (its own files) |
| 2.7 | **Lesson feedback while playing.** "Fühlt sich falsch an" on each lesson step and quest opens a small form: what (Griff / Tempo / Text unklar / anderes) plus a note. Table `game_feedback`, route file `routes/game/feedback.ts`. A Studierstube "Daten" tab lists the feedback and exports it as Markdown, so the owner can hand it to Claude for lesson fixes. | S | ∥A |
| 2.8 | e2e covering the ladder (mark 3 clean runs, step moves up), feedback, and recording hidden without a device and shown with a mocked device. Docs. | S | → all |

**Parallel plan:**
1. Wave 1: 2.1, 2.2 and 2.7 (disjoint files).
2. Wave 2: 2.3, 2.4, 2.5 and 2.6. 2.3 and 2.5 both touch the Tavern wrapper, so give the wrapper to 2.3 and have 2.5 add a separate `SongProgress.tsx` that 2.3's wrapper renders. Agree the export name in the dispatch.
3. Wave 3: 2.8.

**Complexity hotspot:** 2.3, because of the SongView boundary (no game imports). Put the `practice` prop's interface in the brief up front.

**Owner checks:**
- Is 3 clean runs per step right?
- Do the tempo steps feel good?
- Does a real recording sound OK, both from the laptop mic and from the interface?

---

## Phase 3 — Guidance: weekly review, spaced repetition, ear training

| ID | Task | Complexity | Group / deps |
|---|---|---|---|
| 3.1 | **Plateau detection in core.** `packages/core/src/game/review.ts` provides `weeklyReview(history, records, ladder, now)`. It returns:<br>• minutes this week vs the last 4 weeks;<br>• new records;<br>• **plateaus**: a metric with ≥ 4 data points over ≥ 21 days whose best moved by less than 5 %;<br>• **neglected**: a chosen lesson not practised for 10 days;<br>• **wins**: ladder steps gained.<br>The thresholds are prefs. Pure and fully unit-tested. | M | ∥A |
| 3.2 | **Mentor review screen.** Every Monday, or on the first visit of a new week, Meister Orlo's "Wochenrückblick" card appears. It has 3–5 lines from templates in `review.json`, in German with two tones: knapp / ausführlich (pref `mentor.ton`). It is dismissible, and past reviews live in the Chronicle. **No guilt:** a week with no practice gets a neutral welcome-back line only. | M | → 3.1; ∥B |
| 3.3 | **Plateau suggestions on the Quest Board.** For each plateau, offer one concrete change from a rule table in core: change the chord pair, drop the tempo by 10 % and go up again, use a different drill quest, or play it in the Jam Room. Shown under "Bester nächster Schritt" as "Vorschlag aus dem Rückblick", one click to add it to today. | M | → 3.1; ∥B |
| 3.4 | **Card system (spaced repetition).** Reuse `packages/core/src/srs/fsrs.ts` and `queue.ts`. Table `game_cards(skill_id, card_id, deck, state_json, due_at)` with routes in `routes/game/cards.ts`. Card generators in core (`cards/fretboard.ts`, `cards/chords.ts`, `cards/theory.ts`): note positions per string and tuning, chord shapes (name → diagram, diagram → name), intervals and scale degrees. Decks switch on and off in prefs. | L | ∥A (its own files) |
| 3.5 | **Card UI and warm-up quest.** A card view with an answer by click (fretboard grid, chord diagrams) and an *optional* answer by playing, when `canUse("mic")`, reusing NoteFinder's pitch detection. Quest kind `aufwaermen-karten`: 3–5 minutes and up to N due cards (pref), put at the top of the set when cards are due. Content staging id range **Q-3000–3049**. | M | → 3.4, 1.3; ∥B |
| 3.6 | **Ear training.** Synthesised with Web Audio: plucked-string tones (Karplus-Strong), so no samples are needed. Exercises: intervals (m2–P8), major vs minor triad, power chord vs third, "which chord change" from 2–3 choices in the target song's key. Answers by click. A quest kind `gehoer` with level scaling (fewer choices → more choices, melodic → harmonic). Its own place, "Glockenturm", via `places.ts`, plus quest tool registration. Mixer channel `ear`. Content range **Q-3050–3099**. | L | ∥A (synth) then ∥B (UI) |
| 3.7 | e2e covering review shown once per week (fake clock), a card answered by click, and an ear-training round. Docs. | S | → all |

**Parallel plan:**
1. Wave 1: 3.1, 3.4, and the 3.6 synth/engine part (three workers, disjoint).
2. Wave 2: 3.2, 3.3, 3.5 and the 3.6 UI.
3. Wave 3: 3.7.

The content batches (3.5 cards quests, 3.6 ear quests) use the staging pattern with their ranges.

**Complexity hotspots:**
- 3.4 card generators for tunings: reuse the shared `tuningLabels.ts`.
- 3.6 Karplus-Strong quality: keep it simple, tune by ear later.

**Owner checks:**
- Do the plateau rules fire too often or too rarely?
- Is the review tone right?
- Is the ear-training sound pleasant?

---

## Phase 4 — Jam Room 2.0, metronome extras, optional rhythm meter

| ID | Task | Complexity | Group / deps |
|---|---|---|---|
| 4.1 | **Progression builder.** Pick the chords per bar (diatonic choices in the key, plus free entry validated by `chordShape`) and the bar count (4/8/12/16). Save named presets in prefs (`jam.presets`, up to 20). Presets ship for i–VI–III–VII, 12-bar blues, the Andalusian cadence, and metal i–bVI–bVII. Core: extend `JAM_STYLES` into a `JamPattern` type, so progressions are data rather than a fixed table. | M | ∥A |
| 4.2 | **More styles.** Drum and bass patterns for metal gallop, doom (slow, heavy), thrash/blast (capped tempo, density reduced at slow tempos), funk, ballad 6/8 and shuffle. Each is a data entry plus a pattern test. Sound **must** go through the `jam` mixer channel. | M | ∥A (its own data file `jamPatterns.ts`) |
| 4.3 | **Target-note challenges.** While the music runs, the fretboard highlights the chord tones of the current or next chord. Modes: "Terz auf dem Wechsel", "nur Box 2", "Grundton jagen". Self-reported result ("wie oft getroffen?": 1–5) logs as a quest metric. Optional mic help: when `canUse("mic")`, pitch detection counts the hits and **prefills** the number. | M | → 4.1 (pattern type); ∥B |
| 4.4 | **Metronome extras.**<br>• Gap click: N bars on, M bars silent, with silent bars shown visually.<br>• Polyrhythm 3:2 and 4:3.<br>• Accent patterns for gallops.<br>• Tempo trainer down-ramp ("schneller, dann zurück").<br>• Visual-only mode, flashing with no sound, for quiet practice.<br>Lives in `useMetronome` (web) plus MetronomePanel. | M | ∥A |
| 4.5 | **Optional rhythm meter (spec amendment 1).** Shown only when `canUse("mic")` and the pref `rhythmus.messen` is on (default off).<br>• Onset detection in core (`packages/core/src/audio/onset.ts`): spectral flux or energy rise with an adaptive threshold, unit-tested on synthetic click and pluck buffers.<br>• Latency calibration: play along with 8 clicks and store the measured offset in prefs.<br>• Display: a live dot strip (early / on / late, ±ms) and a round summary ("Ø +18 ms, eher eilig, 82 % im Fenster ±40 ms").<br>• It **never** changes XP; it may only prefill the quest's metric field. Available in the metronome panel, quests and the Jam Room.<br>Tests: synthetic buffers only. | XL | ∥A (core) then ∥B (UI, → 1.4) |
| 4.6 | e2e covering a preset saved and reloaded, gap click visuals, and the rhythm meter hidden without a device. Docs. | S | → all |

**Parallel plan:**
1. Wave 1: 4.1, 4.2, 4.4 and the 4.5 core.
2. Wave 2: 4.3 and the 4.5 UI.
3. Wave 3: 4.6.

**Complexity hotspot:** 4.5 is the hardest task of the roadmap. Give it the most capable model and its own reviewer, and keep its UI gated so a shaky detector never harms the core loop.

**Owner checks:**
- Every new style by ear.
- The metal volume.
- Whether the rhythm meter feels honest with your real guitar.
- Whether the calibration works.

---

## Phase 5 — Atmosphere, deep customisation, offline

| ID | Task | Complexity | Group / deps |
|---|---|---|---|
| 5.1 | **Mixer and ambience 2.0.** A mixer with channels (`ambience`, `effects`, `metronome`, `jam`, `ear`) and a master channel, each with volume and mute in the Studierstube "Klang" tab. If Phase 1 already created a minimal mixer, extend it. Ambience gets one layered, Web-Audio-synthesised soundscape per place:<br>• harbor: waves, gulls, rigging;<br>• market: distant murmur from filtered noise, plus clinks;<br>• library: fire crackle, page turns;<br>• Chronicle: quill scratches, clock;<br>• map: wind.<br>Variation over time, so nothing loops audibly. **Day and night** follow the local clock: crickets at night, a softer bell, a darker painting tint (5.3). Optional "weather": rain at random or as a pref. Rules stay: never on quest or tool screens, and never while a free timer, the metronome or the Jam Room runs (`useAmbience`'s `allowed`). A crossfade on every place change. | L | ∥A |
| 5.2 | **Musical stingers.** Short motifs on level-up, record, ladder step and story beat, through the `effects` channel, with a pref to turn them off. Each one never plays while the metronome, Jam Room or a recording runs. | S | → 5.1 mixer; ∥B |
| 5.3 | **Visual atmosphere and themes.**<br>• Day/night tint on the village painting and the map (CSS filters by time, pref "Tageszeit: automatisch / Tag / Nacht").<br>• Themes: Pergament (default), Nacht, Hoher Kontrast.<br>• Font size S/M/L.<br>• `prefers-reduced-motion` plus a pref.<br>• Status-bar layout: compact or full, and which stats show.<br>Put the parchment frames on tokens so the theme switch is one place. | M | ∥A |
| 5.4 | **Practice customisation.**<br>• Custom session lengths, a list in prefs.<br>• Quest-mix weights: technique / changes / song / theory / ear / cards, as sliders that keep at least one of each kind the owner enabled.<br>• Difficulty pace: the "zu leicht" count needed to suggest +1, and "zu schwer" for −1.<br>• A rest day per week: the streak forgiveness day is configurable.<br>• Default count-in beats.<br>• Default tuning.<br>• Character name and title style. The level titles stay, the owner's name is added.<br>• Mentor on or off: story beats can be muted entirely.<br>All are entries in the `PREFS` registry; the logic reads prefs. | M | ∥A (core + prefs), several small workers |
| 5.5 | **Offline and phone.** The PWA already exists (`vite-plugin-pwa` in `packages/web/vite.config.ts`).<br>• Precache lessons, images and the game JSON.<br>• An **offline log queue**: IndexedDB `pendingLogs`, replayed in order on reconnect, with a visible "N Einträge warten auf den Server" chip.<br>• Read-only offline for the Chronicle, from the last snapshot.<br>• Install prompt in the Studierstube.<br>• Test on a phone through `npm run dev:lan`. | L | ∥A |
| 5.6 | **Data portability.** Import from the Phase 1 export: restore into an empty DB, or merge. Settings export and import as JSON. All in the Studierstube "Daten" tab. | M | → 1.2; ∥A |
| 5.7 | **Intro and docs refresh.** Update the intro steps for all the new places (Glockenturm, Studierstube) and the new features, and keep it skippable. Final e2e sweep: one spec per phase feature that is still missing. README and reference pages. | S | → all |
| 5.8 | **Whole-roadmap review.** Most capable model. Simulate a month of use with fake clocks: a week off, plateaus, offline days, a device on and off. Then run the triage. | M | → all |

**Parallel plan:**
1. Wave 1: 5.1, 5.3, 5.4 (split into 2–3 workers by pref group), 5.5 and 5.6. That is five or more workers. 5.1 and 5.3 both touch village and map rendering, so give the painting tint (CSS) to 5.3 and the sound to 5.1.
2. Wave 2: 5.2.
3. Wave 3: 5.7.
4. Wave 4: 5.8.

**Owner checks:**
- Every ambience by ear, day and night.
- Whether any sound gets in the way.
- Theme readability.
- Offline use on the phone, then reconnect.

---

## Cross-phase summary

| Phase | Tasks | Max parallel | Hardest task | New tables |
|---|---|---|---|---|
| 1 Foundation | 12 | 7 | 1.2 server split + prefs (L) | game_prefs, game_gold_adjust |
| 2 Songs | 8 | 4 | 2.3 ladder in SongView, 2.6 recording (L) | game_song_sections, game_recordings, game_feedback |
| 3 Guidance | 7 | 4 | 3.4 cards, 3.6 ear synth (L) | game_cards, game_reviews (optional) |
| 4 Jam / rhythm | 6 | 4 | 4.5 onset detection (XL) | none (prefs only) |
| 5 Atmosphere | 8 | 6 | 5.1 ambience 2.0, 5.5 offline queue (L) | none |

**Dependency spine:** 1.2 → (1.3, 1.4, 1.5) → everything else. Inside a phase, the core/data tasks run first in parallel, then the UI tasks in parallel, then e2e.

**Optional-device features, all gated behind `canUse(...)` with default off:**
- 2.6 recording.
- 3.5 answer by playing.
- 4.3 mic hit counting.
- 4.5 rhythm meter.
- The Shrine device check (1.4) and the existing tuner and Note Finder mic, which keep their click fallbacks.

None of these blocks a phase: each one finishes with mocks, and the owner checks the real device afterwards.

**Rough edges carried in from the QOL pass:**
- Enter during a trainer round: 1.1a.
- Hidden gold debt: 1.1b.
- Sub-4h forgotten timer: 1.1c.
- The recentLog cap of 20: 1.1d.
- Calendar keyboard access: 1.1e.
- The deferred-minor batch: 1.1f.
