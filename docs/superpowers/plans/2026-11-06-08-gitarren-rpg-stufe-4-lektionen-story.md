# Guitar RPG Stage 4: Lessons and Story Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Tasks 1 to 13 run in parallel. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Write the 55 remaining lessons with quests, so every map node except the three known songs opens, and add a short mentor story along the gold road. "In Vorbereitung" ends here.

**Architecture:** Lessons are MDX plus JSON data, so they are written in parallel into a git-ignored staging folder, `.stage4/`, and merged once by a script. That keeps the tree green for the code tasks running beside them, and no two workers edit `quests.json`. The story is a separate content file with its own pure rules in `packages/core`, one new table, and one small non-blocking mentor card.

**Tech Stack:** TypeScript, React 18, TanStack Query, Hono, better-sqlite3, zod, MDX, Vitest, Testing Library, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md`

**Scope:** Stage 4 of 5, as assigned by the "Later stages" table of the stage 1 plan. Market, gear, ambience and art are stage 5. The known songs (`song-creep`, `song-rising-sun`, `song-nothing-else-matters`) stay "Bekannter Song" nodes with no lesson: they are free play, and the spec keeps them out of the road. Baseline: 90 test files, 1174 tests, all passing.

## Global Constraints

- All site text German. Region names and titles may stay English. Notes use German naming in prose (H, not B).
- Every lesson: `<Ziel>`, `<Handhaltung>`, `<Fehlerbild>`, `<Uebung>`, `<Checkpoint>`, at least one visual. Style of `07-akkordwechsel.mdx` and `metal-palm-mute.mdx`: direct, concrete, short.
- No concept before it is taught. A road lesson may only use what comes earlier on the road or in its parent chain. An off-road lesson may also use its own parent chain.
- All riffs and exercises are original. No commercial tabs or lyrics. Song lessons name chords and sections only.
- Musical accuracy matters: every fret, note name, interval and scale degree is checked, not trusted.
- Story stays brief: at most four short lines per beat, never in the way of practising, never modal, never during a quest. No guilt, no shaming, no lost progress.
- Nothing is hard-locked. XP only follows practice. Game state in SQLite. Local day logic.
- Japanese, demo, review and Anki features stay unchanged. Existing songs and chord overrides stay usable.
- Stop `npm run dev` before e2e. Never write to `packages/server/data/app.db`.
- Work on `master`. Only the coordinator commits, because parallel workers share one checkout. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A beginner must never get an off-road lesson as filler: rank 9 Sweep on day one is the failure. Test in Task 1.
- A player placed far along the road must see one mentor beat, not a queue of twenty. Test in Task 2.
- `metal-ganzer-song` must work with no target song, with a target song, and with a target song the owner later deleted. Test in Task 1.
- A CAGED shape quest near the top of the neck must stay on the 15 drawn frets. Test in Task 1.
- Every chord named in a `<Griffbild>` must resolve to a shape. Test in Task 14.

---

## Staging format

```
.stage4/lessons/<node-id>.mdx      one lesson, the final file
.stage4/fragments/<batch>.json     everything else the batch adds
.stage4/story.json                 Task 3
.stage4/songs.json                 Task 4
.stage4/check.mjs                  validator: node .stage4/check.mjs <batch>
```

A fragment:

```json
{
  "quests": [{ "id": "...", "title": "...", "description": "...", "kind": "technik", "techniqueId": "...", "lessonId": "...", "minutes": 10, "icon": "bolt", "scale": { "bpm": [60, 100] } }],
  "riffs": [{ "id": "...", "title": "...", "description": "...", "lessonId": "...", "bpm": 90, "zeilen": ["6 equal lines"] }],
  "chords": [{ "symbol": "Bm7", "name": "Hm7", "frets": [null, 2, 4, 2, 3, 2], "fingers": [null, 1, 3, 1, 2, 1], "baseFret": 1 }],
  "nodes": { "<node-id>": { "techniqueId": "...", "links": [{ "to": "...", "reason": "..." }] } },
  "noTempo": ["<node-id>"]
}
```

Rules for every batch:

- One quest at least per lesson, the first one with that `lessonId` is the road quest. Quest `techniqueId` equals the node's. Quest `kind` is `technik`, or `theorie` for theory path lessons at 5 to 10 minutes. Only `metal-ganzer-song` uses `song`.
- Quest `scale` declares how it grows: `bpm` for tempo work, `runs` otherwise. Only a listening lesson may leave it empty. The description says what to do, with no leaving the quest.
- Measurable lessons get `metricLabel` and `masteryTarget`, mostly "Sauberes Tempo (BPM)". The lesson text names the same target.
- Quest tools: `fretboard` `{root, scale, box?, caged?}`, `noteGame` `{strings}` (0 is low E), `riffId`, `chords`, `tuning` (one of Standard, Drop D, Half Step Down, Open G). Use them, so the quest holds what it needs.
- `order` in `meta`: rhythmus 201 up, finger 221 up, theorie 241 up, metal 261 up, lead 281 up, griffbrett 301 up. `requires: null`. `title` equals the node title exactly.
- `<Uebung bpm={n}>` wherever a tempo applies. A lesson without a tempo goes into `noTempo`.
- `Tab` lines are at most 40 characters and all six equal length. `GriffbrettBild` takes `punkte` `{saite, bund, text?}`, saite 1 is high e, and `bis` for the last fret. `RhythmusRaster` takes `muster` of D, U, x, - and optional `zaehlzeiten`.
- Griffbild names come from `OPEN_CHORDS` and `chordShape` in `packages/core/src/music/chords.ts` and `skills/guitar/chords/eigene.json`. A missing shape goes into `chords`.
- Add one or two cross-links only where a real connection exists.
- Do not edit anything outside `.stage4/`.

---

### Task 1: Core rules for a complete map

**Files:** `packages/core/src/game/quests.ts`, `map.ts`, tests; `skills/guitar/game/quests.json`, `map.json`, `FretOverlay.tsx`, `QuestView.tsx`, `RiffViewer.tsx`, `map/LessonPanel.tsx`, tests.

- [ ] **Off-road filler rule.** Today `fillable` lets any off-road quest fill a set at once. New rule: an off-road lesson counts as reached when it is quick, or chosen, or its parent is done (`gelernt` or `gemeistert`). `reached` and `slot` use the same rule, which also closes the open item that off-road theory is never reached before the road ends. Tests: beginner gets none, a player whose parent is done may get it, chosen always works.
- [ ] **One technique rule.** Add technique `griffbrett` ("Griffbrett"). All nodes on path `griffbrett` with `techniqueId: null` get it. Add a content test that no node has `techniqueId: null` unless `knownSong`.
- [ ] **CAGED in quests.** `fretboardSchema` gets optional `caged` of C, A, G, E, D. `FretOverlay` passes `cagedShape(root, shape)` as `only`. Test with a root that would run past fret 15.
- [ ] **Song choice.** `mapNodeSchema` gets `chooseTarget: z.boolean().default(false)`. For such a node, `LessonPanel` lists `node.songs`, each with "Als Zielsong setzen", the marker "Ist dein Zielsong", or the import link, reusing `TargetSong`. `metal-ganzer-song` sets it. Its quest uses the existing `SongPanel`, because `lessonSong` is null. Test all three cases of the Review Focus. A deleted target must show the existing "Zielsong wählen" path, never a crash.
- [ ] **Riff card.** Carried item: `RiffCard` links the Shrine with `quest=` when in a quest, and shows one link only when quest and riff both have a tuning.
- [ ] Run `npx vitest run packages/core skills/guitar`. Report; do not commit.

### Task 2: Story engine, server and mentor card

**Files:** create `packages/core/src/game/story.ts`, `story.test.ts`, `skills/guitar/game/story.json` (a small valid placeholder, Task 14 replaces it), `skills/guitar/game/MentorCard.tsx`, `StoryLog.tsx` with tests. Modify `packages/core/src/game/index.ts`, `api-types.ts`, `packages/server/src/db/client.ts`, `routes/game.ts`, `game.test.ts`, `skills/guitar/game/api.ts`, `Village.tsx`, `QuestBoard.tsx`, `Places.tsx`, `game.css`.

Do not touch `quests.ts`: story has its own parser and stays out of `GameContent`.

```ts
export const storySchema = z.object({
  mentor: z.object({ name: z.string().min(1), role: z.string().min(1) }),
  chapters: z.array(z.object({
    id: z.string().min(1), title: z.string().min(1),
    months: z.tuple([z.number(), z.number()]),
    intro: z.string().min(1), theoryLessons: z.array(z.string().min(1)),
  })).min(1),
  beats: z.array(z.object({
    id: z.string().min(1), chapterId: z.string().min(1),
    when: z.enum(["next", "done"]), lessonId: z.string().min(1),
    title: z.string().min(1), lines: z.array(z.string().min(1)).min(1).max(4),
  })),
});
export function parseStory(input: unknown, content: GameContent): Story           // checks references: beat lessons on the road, chapters exist, unique ids
export function reachedBeats(story: Story, road: RoadStep[], statuses: Record<string, LessonStatus>): Beat[]
export function pendingBeat(story: Story, road: RoadStep[], statuses: Record<string, LessonStatus>, seen: string[]): Beat | null
export function currentChapter(story: Story, road: RoadStep[], statuses: Record<string, LessonStatus>): Chapter
```

- `reachedBeats`: in road order, `next` before `done` at the same step. A `done` beat is reached when its lesson is done. A `next` beat is reached when the best next step is at or past its lesson, or the road is finished.
- `pendingBeat`: the last reached beat that is not seen. So a placed player sees one beat.
- `currentChapter`: the chapter whose months hold the best next step's first month. Road finished means the last chapter.
- Server: table `game_story_seen (skill_id, beat_id, seen_at, PRIMARY KEY (skill_id, beat_id))`, `GameState.storySeen: string[]`, `PUT /api/game/:skillId/story/seen` with `{ beatIds: string[] }`, at most 200, insert or ignore.
- `MentorCard`: a small panel with mentor name, beat title, lines and one button "Weiter", which marks all reached beats seen. It renders on Village and Quest Board, below the quest controls, and never blocks them. It renders nothing on failure. A failed save keeps the card and shows a German alert.
- `StoryLog` at the top of the Library overview, only when no lesson is open: chapter title and intro, "Passt zu diesem Kapitel" with links to `theoryLessons` and a done mark, and a closed `details` "Bisherige Geschichte" with the reached beats.
- [ ] TDD for core and the route. Run `npx vitest run packages/core packages/server skills/guitar/game`. Report; do not commit.

### Task 3: Story text

**Files:** create `.stage4/story.json` in the schema of Task 2.

Mentor: **Meister Orlo**, an old harbor bard whose left hand no longer closes. He once stalled on the same three songs himself, which is why he recognises the owner's situation. Warm, dry humour, never scolding. He never plays for you, he sends you on. Frame: the harbor's songs were carried off along six roads, one per region, and every region gives one back. Original names only, no borrowing from existing games or books. Direct address with "du".

- 4 chapters by road quarter, months `[1,3] [4,6] [7,9] [10,12]`, each with a title and two-line intro.
- About 22 beats: a prologue at `01-haltung` (`next`), one region intro (`next`) at the first road lesson of each region, milestone beats (`done`) at `07-akkordwechsel`, `song-bards-ganz`, `10-barre`, `11-pentatonik`, `13-theorie`, `caged-g`, `lead-erstes-solo`, `metal-ganzer-song`, and an ending at `jam-frei`.
- `theoryLessons`: every node on path `theorie` in exactly one chapter, chosen by road month, off-road ones by rank, plus `03-saiten-buende` in chapter 1.
- Beats may mention what the owner has done, never numbers or dates.

### Task 4: Song verification

**Files:** create `.stage4/songs.json`: `{ "<node-id>": [{ "title", "artist", "trains", "source" }] }`.

Find real matches for: `metal-ganzer-song` (four to six songs a player at month 11 can finish, downpicking, gallop, tremolo, syncopation, with `chooseTarget`), `metal-thrash-boss`, `metal-drop-d`, `metal-tremolo`, `rhythmus-funk`, `rhythmus-shuffle`, `rhythmus-barre-songs`, `finger-clean-intro`, `finger-stimmungen`, `lead-erstes-solo`. Do not touch nodes that already have songs. Each claim is checked on the web: tuning, technique, and that the song really uses it. `source` is an https URL of a reliable page that states that fact. Drop what cannot be verified. `trains` is one German line. No tabs, no lyrics. Report what was dropped and why.

### Tasks 5 to 13: Lesson batches

Each batch reads the rules above, the two style lessons, `map.json` for its nodes (title, description, parent, rank) and `road.json` for what comes before. Run `node .stage4/check.mjs <batch>` until clean. Report anything doubtful.

**Task 5, batch `rhythmus`:**
- `rhythmus-moll-barre`: Am-shape barre with root on A, Hm, Cm, major and minor; same chord in two places. `barre`. BPM [50, 90].
- `rhythmus-sus-sept`: Dsus2, Dsus4, Asus2, Asus4, E7, A7, D7, G7, Am7, what sus and 7 mean by ear only. Off-road after Ankerfinger, so no theory terms beyond it.
- `rhythmus-synkopen`: stroke on the "+", ties across the beat, hand keeps moving. `RhythmusRaster`.
- `rhythmus-shuffle`: triplet feel, swung eighths, a 12-bar blues in A with `zaehlzeiten`.
- `rhythmus-sechzehntel`: count 1 e + a, sixteenth strumming with 16-cell grids.
- `rhythmus-funk`: muted scratch, short chord stabs on upper strings, ninth-free shapes.
- `rhythmus-barre-songs`: an original chord set in barre only, moving between E and A shapes; metric "Sauberes Tempo (BPM)".

**Task 6, batch `finger`:**
- `finger-flageolett`: natural harmonics at 12, 7, 5; touch without pressing; on electric with neck pickup.
- `finger-wechselbass`: alternating bass under C, G, Am, thumb steady.
- `finger-travis`: thumb on beats, fingers between, original pattern.
- `finger-hybrid`: pick plus middle and ring finger.
- `finger-clean-intro`: clean arpeggios into distortion, original intro in Em, volume and pickup choice.
- `finger-akkordmelodie`: melody on top string above chord shapes, original tune.
- `finger-stimmungen`: Open G and Drop D, what changes, retuning safely. Quest with `tuning: "Open G"`.
- `finger-arrangement`: build a solo arrangement of a public-domain tune, such as "Greensleeves" or "Scarborough Fair" (traditional), in steps.

**Task 7, batch `theorie-a`** (road): `theorie-dur-tonleiter` (whole and half steps, C major on one string, then one position), `theorie-intervalle` (name and hear second to octave, by familiar sounds, no commercial song quotes needed), `theorie-akkordbau` (triads from thirds, major, minor, diminished, power chord as no-third), `theorie-tonarten` (key, sharps and flats, circle of fifths, finding the key of a song), `theorie-moll` (natural minor, relative keys, Am and C).

**Task 8, batch `theorie-b`** (off-road): `theorie-akkordfolgen` (hear I IV V vi), `theorie-riff-hoeren` (transcribe a riff by ear, method, original test riffs), `theorie-analyse` (Roman numerals on own songs, chords only), `theorie-modi` (Aeolian, Phrygian, Dorian, Locrian in metal: the characteristic note), `theorie-harmonisch-moll` (raised seventh, the V chord, its sound in metal).

**Task 9, batch `metal`:**
- `metal-galopp`: eighth plus two sixteenths, down-up-down or all down, `RhythmusRaster`, original riff. BPM [70, 140], metric.
- `metal-drop-d`: tune via Shrine, one-finger power chord, original riff. `tuning: "Drop D"`.
- `metal-tight`: recording oneself, playing on the click, ends of notes, muting rests. Metric.
- `metal-tremolo`: tremolo picking on one note, then a melody, small motion from the wrist. BPM [80, 180], metric.
- `metal-synkopen`: accents off the beat with palm mute, original riff.
- `metal-zweistimmig`: harmonising in thirds on two strings, one guitar plays both parts in turn or with a loop.
- `metal-ganzer-song`: `chooseTarget`, how to learn a whole song part by part, kind `song`, `lessonId` set, `sections` "Intro und Riff", "Strophe und Refrain", "Solo-Teil oder Bridge", "Ganzer Song", `runs: [1, 4]`, `tempoPercent: [50, 100]`, metric "Ganze Durchläufe", target 3. Name no song in the lesson text: the panel lists them.
- `metal-thrash-boss`: an original thrash riff in two parts, boss lesson. BPM [100, 200], metric.

**Task 10, batch `lead-a`** (road): `lead-bending` (half and whole step, check against the fretted target note, three fingers), `lead-vibrato` (wrist, width and speed, on bent notes), `lead-phrasen` (call, breath, ending on the root, original licks), `lead-boxen` (five boxes in A minor pentatonic, `fretboard` box 1 to 5, connecting by the shared notes), `lead-erstes-solo` (boss lesson: 12 bars over a Jam Room backing, structure low to high, quest `fretboard`).

**Task 11, batch `lead-b`** (off-road): `lead-wechselschlag` (strict alternate picking, metric), `lead-legato` (hammer and pull chains, left hand only), `lead-moll` (natural minor in solos, adding 2 and b6 to the pentatonic), `lead-tapping` (right hand tap, triad shape, muting), `lead-sweep` (three-string sweeps first, then five, roll, muting, slow).

**Task 12, batch `griffbrett-a`:**
- `griffbrett-noten`: notes on E and A strings, naturals first, memory anchors. `noteGame` strings [0, 1]. Keeps technique `theorie`.
- `griffbrett-oktaven`: octave shapes, two strings apart.
- `griffbrett-alle-noten`: notes on all strings, by octaves and the note game. `noteGame` all strings.
- `caged-e`, `caged-d`, `caged-c`, `caged-a`, `caged-g`: one shape each, root positions, the shape as a major chord up the neck, `fretboard` with `caged` and root. `caged-g` closes the ring and links back to `caged-e`. Note that the order on the road is E, D, C, A, G.

**Task 13, batch `griffbrett-b`:** `jam-frage-antwort` (play two bars, answer two bars, Jam Room), `caged-verbinden` (move one chord across all five shapes, then one pentatonic box per shape), `jam-akkordtoene` (land on chord tones on the change), `jam-frei` (final road lesson: no rules, a small routine for free playing, what to do next). Quests point to the Jam Room in words, and use `fretboard`.

### Task 14: Merge and integrate

Coordinator, by script.

- [ ] Move `.stage4/lessons/*.mdx` into `skills/guitar/lessons/`.
- [ ] Merge fragments: append quests and riffs, set `node.available`, techniques and links, set `road[].questId` to the first quest of the lesson, add `chords` to `eigene.json`, add songs from `.stage4/songs.json`, set `chooseTarget` on `metal-ganzer-song`, copy `story.json`.
- [ ] Update tests: `covers every available lesson on the road or as a quick win` goes away, `WRITTEN_IN_STAGE_2` gets a stage 4 list, `lessons.test.ts` takes `noTempo`.
- [ ] Add content tests: every non-known node is available, every quest with a tuning exists, every `<Griffbild>` chord resolves, every `metricLabel` quest has a `masteryTarget`, every lesson `meta.title` equals the node title, which also closes the 7 old differences.
- [ ] Run `npm test && npm run build`. Commit.

### Task 15: Accuracy review

Six reviewers in parallel, one per path, read-only. Each checks all frets, note names, intervals, chord spellings, tab rhythm against stated counts, forward references against road order, and originality. A second pass uses a script that recomputes every `<GriffbrettBild>` label from its string and fret. Reports go to the coordinator, fixes go to one fixer per path. Commit.

### Task 16: Close out

- [ ] Remove `moreComing` and `MORE_COMING`; finishing the road shows `ROAD_DONE_REASON`. Update `tips.test.ts`, the stage-1 player test and UI tests.
- [ ] Remove the "In Vorbereitung" branches that can no longer happen, keeping `available` in the data, and the spec's exception is gone.
- [ ] Add `e2e/guitar-story.spec.ts`: mentor card on the village, "Weiter" clears it, Library shows the chapter. Add to `e2e/guitar-map.spec.ts`: a late lesson opens.
- [ ] Update `README.md` and `PROJECT_LOG.md`.
- [ ] Run `npm test && npm run build && npm run test:e2e` with `npm run dev` stopped. Commit.
