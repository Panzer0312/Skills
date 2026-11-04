# Guitar RPG: design

Date: 2026-11-04. Replaces the plain guitar area of the Skills app with a medieval RPG that gives
daily guidance. "Decided" marks what the owner chose. "Builder's call" marks defaults proposed
during design that may be changed if a better option appears.

## Why

The owner plays electric guitar and is stuck. They can play Nothing Else Matters, House of the
Rising Sun and Creep, and quit The Bard's Song after the intro. They repeat those songs, see no
measurable progress, change chords slowly, and do not know what to learn next. They want metal
songs and free jamming (CAGED and so on). They learn visually.

**Constant guidance is the main thing this project must deliver.** The game layer exists to make
daily practice fun and to make progress visible. It must never become a substitute for playing.

## Success

- From the village, one click starts a practice quest.
- There is always one named best next step, with a reason.
- Chord changes per minute are measured and visibly climb over weeks.
- Minutes, streak, level and progress are always on screen.
- The owner can see the whole first year, where they are, and what each lesson leads to.
- Practising is fun enough to come back daily, for about 30 minutes, sometimes less.

## Goals

1. Village hub as home screen, with a persistent status bar.
2. Daily quests with personal difficulty 1 to 10, adapted from the owner's answers.
3. Branching skill map of about 80 guided German lessons, with quick wins and cross-links.
4. A gold first-year main road through the map, plus a Tips Board.
5. All existing guitar tools moved into the game and improved, plus three new tools.
6. Real tracking of minutes, results and measured skill numbers.
7. Gear rewards in a Market. A story that progresses along the main road.

## Non-goals

- Changes to Japanese, the demo skill, or the review and Anki features.
- Accounts, multiplayer, cloud sync, leaderboards.
- Automatic judging of the owner's playing from audio. Results are self-reported. The only
  microphone game is note finding on the fretboard.
- Shipping commercial tabs or lyrics (existing project rule).
- Cloning any existing game. Diablo is a reference for tree structure only. Names, art and story
  are original.

## Anti-goals

These count as failure even if everything technically works.

- More clicking than playing.
- Feeling lost again: a big tree with no clear next step.
- Guilt mechanics: lost progress, shaming, punishing missed days.
- Hard walls. Nothing is locked (see Skill map).
- XP for doing nothing. Rewards follow practice time and honest answers.
- Sound that interferes with practice.

## Language

Decided: all instructions, lessons, tips, buttons and story text in German. Names such as regions
and titles may stay English (Forest of Changes, Squire of the Strings).

## Screens

### Status bar (decided)

On every game screen: level and title, XP bar, streak, total time played, time this week, and a
way back to the village.

### Village (decided, mockup option A)

The harbor painting is the home screen with clickable places. Hotspots are placed in percentages
so they scale with the image.

| Place | Purpose |
|---|---|
| Quest Board | today's quests |
| Tavern | saved songs and song recommendations |
| Library | theory lessons, tied to story chapters |
| Harbor | opens the skill map |
| Market | gear rewards (decided: keep) |
| Shrine | tuner |
| Forge | chord diagrams, editor, Chord Change Trainer |
| Jam Room | backing tracks |
| Chronicle | stats and graphs |

Today's quests also appear as a small panel on the village screen, so starting one takes one
click. The owner accepted this. Shrine, Forge, Jam Room and Chronicle may be hotspots or a compact
menu if the painting lacks room (builder's call).

### Daily quests

- The owner picks a session length (for example 10, 20, 30, 45 minutes). Default 30.
- The board proposes a set that fits, and the owner can swap or skip quests. With little time the
  list shrinks to the most important item.
- A normal set mixes: main-road technique, chord changes, a song, and a short theory task
  (builder's call on the exact rules). While chord speed is the owner's weakness, a change drill
  appears in most sessions.
- Quest view holds everything needed: instructions, visualization, timer, metronome, and the tool
  it needs. No leaving the quest to find a tool.

### After each quest (decided)

1. One tap: **zu leicht, passt, zu schwer**.
2. Where measurable, enter a number: changes per minute, clean BPM.
3. The site suggests a new difficulty for next time. The owner confirms or overrides with the
   1 to 10 slider.
4. Higher difficulty changes the task itself (tempo, duration, harder chord pair) and pays more XP.

Builder's call: each lesson has a fixed **base rank** 1 to 10 that orders the map, and each
technique has a **personal level** 1 to 10, which is what the slider changes and what scales the
quest. Starting rule: two "zu leicht" in a row suggests +1, one "zu schwer" suggests -1. Tune it
if it feels wrong.

Every quest type declares how its parameters scale with personal level. No hardcoded global rule.

### First launch

The site asks what the owner already knows and can play, then marks those lessons done and sets
starting levels. It must handle a non-beginner: known songs, but slow changes. The first
recommendation after that for this owner is One-Minute Changes. Lessons marked done by the old
course in `lesson_progress` carry over.

### Skill map (decided, clickable mockup)

Paths start at the Harbor and each has a different shape:

| Path | Region | Shape | Examples of endpoints |
|---|---|---|---|
| Rhythm | Forest of Changes | branching tree | funk muting, barre songs |
| Fingerpicking | Bard's Grove | winding vine | solo arrangement |
| Theory & Ear | Star Library | constellation | modes for metal, transcribing |
| Metal | Iron Hills | jagged zigzag | thrash riff boss |
| Lead | Dragon Peak | spiral | sweep arpeggios, first solo boss |
| Fretboard & Jam | Tower of CAGED | ring of five shapes, then a branch | Free Jam |

Map rules:

- Lessons are ordered along each path by difficulty. Green 1-3, amber 4-6, red 7-10.
- **Quick wins**: gold star nodes on short dotted side paths for fast success. They remind the
  owner to return and refine.
- **Cross-links**: purple dashed lines between paths, like Obsidian links. The lesson panel lists
  them in a dropdown with a one-line reason ("Barre-Griff ist die E-Form").
- **Lesson panel**: difficulty slider, builds on, unlocks, links, songs.
- **Songs for this**: optional, only where a real match exists. Name, artist and what it trains.
  No tabs. The owner imports the song into the Tavern.
- **Navigation pane**: search, progress per path, difficulty filter.
- **Tips Board**: best next lesson with reason, one quick win, one stay-on-track tip. Best next
  also pulses on the map.
- **Nothing is hard-locked**. The map warns about missing basics, but any lesson can be opened.
- The map must stay legible with about 80 nodes: zoom and pan, labels that do not collide.

### First-year main road

A gold route across paths. Decided outline:

| Months | Focus |
|---|---|
| 1-3 | chord changes, rhythm, power chords, palm muting, finish The Bard's Song |
| 4-6 | barre chords, metal rhythm, pentatonic, bends, notes on E and A strings |
| 7-9 | CAGED, five pentatonic boxes, keys, first jams |
| 10-12 | connect shapes, a full metal song, improvise freely |

Pace follows real progress, not the calendar. Months are guidance only (builder's call).

### Lesson states and active lessons (builder's call)

- **Offen**: not started. **Aktiv**: being practised. **Gelernt**: lesson worked through and its
  `Checkpoint` confirmed by the owner. **Gemeistert**: the lesson's measurable target was reached,
  or, without a metric, three "passt" or "zu leicht" results on different days.
- *Gelernt* moves the main road forward, so the owner keeps moving. *Gemeistert* is separate and
  stays visible on the map, so unfinished refinement is not forgotten. Quick wins become *Gelernt*
  after one successful quest and keep a "verfeinern" reminder until *Gemeistert*.
- Starting a lesson on the map makes it *Aktiv*. Active lessons feed the daily quests. At most
  three at once: the main-road lesson plus two chosen by the owner. Taking a fourth asks which one
  to pause.
- Best next always follows the gold road. Lessons the owner chooses add to the board and never
  replace that recommendation, so map and board do not contradict each other.

### Songs on the road (builder's call)

- Song lessons are real lessons with original preparation exercises for the hard parts, described
  in words, chord names and original exercises. They contain no tabs or lyrics.
- A song lesson links to an imported song through a tracked **target song**. If the song is
  missing, the lesson asks the owner to import it and the preparation exercises still work.
  The Bard's Song and War Pigs are already imported in the owner's database.
- At the "full metal song" milestone the app recommends several songs matching the owner's level,
  and the owner chooses.
- The daily song quest uses the current target song, never just any Tavern song, so it cannot drift
  back to the three songs the owner is stuck repeating. Those stay available for free play, and
  free play counts as minutes.
- Song quests scale by section, tempo percentage and run-throughs. Target song state is stored
  separately from the free-text `songs` rows.

### Story

Short German story beats tied to main-road milestones, told by an original mentor character.
Regions get an intro. Theory lessons connect to the chapter in progress. Text stays brief: a few
lines, never in the way of practising.

### Market and progression

Gear is earned, never bought with real anything. Decided purpose: rewards. Builder's call: gear
is cosmetic and shown on the character or status bar, gold comes from quests, milestones grant
unique items. Gear gives no gameplay advantage.

Streak, builder's call: one missed day per week does not break it. No penalty beyond the streak
counter.

## Tools

| Tool | Place | Change |
|---|---|---|
| Tuner | Shrine | keep; tuning change one click from quests that need Drop D and so on |
| Metronome | every quest | tap tempo, accents, subdivisions for gallops, speed trainer raising BPM step by step |
| Fretboard | Tower of CAGED | add pentatonic, minor scale and CAGED overlays; note-finding game by microphone, with click fallback |
| Chord diagrams and editor | Forge | keep behavior, show inside quests |
| Song library and import | Tavern | auto-scroll, section loop, mastery stars, last played, technique tags |
| Practice plan | Quest Board | replaced by daily quests |
| Stats | Chronicle | graphs for changes per minute, best BPM, minutes |

New tools:

- **Chord Change Trainer**: two diagrams, 60-second timer with audible start and end, the owner
  enters the count afterwards so both hands stay on the guitar, personal record. Top priority, it
  targets the owner's main weakness.
- **Jam Room**: generated drums and bass in a chosen key, style and tempo, with the matching scale
  shown on the fretboard. Web Audio synthesis, no sample library needed. Reuse the lookahead
  scheduling idea of `useMetronome`.
- **Riff viewer**: tab display for original exercise riffs.

## Lessons

About 80 German lessons, including the 13 existing ones reworked and placed on paths. The
existing lesson style stays (`Ziel`, `Handhaltung`, `Fehlerbild`, `Uebung`, `Merksatz`,
`Checkpoint` blocks in MDX).

Each lesson has metadata: path, base rank, quick-win flag, requires, cross-links with reasons,
optional songs, and quest definition with its metric and scaling. Every lesson includes at least
one visualization: fretboard overlay, chord diagram, tab, rhythm grid or animation.

An electric guitar needs more than notes, so the Metal path also covers amp and gain basics and
controlling noise.

Musical accuracy matters. Every lesson is checked for wrong facts, and every song recommendation
is verified against a reliable source before shipping. Forward references to untaught concepts
are avoided, as was required for the Japanese course. All riffs and exercises are original.

## Architecture

Build on what exists: React, Vite, Tailwind, Hono, SQLite via better-sqlite3, MDX. Pure logic goes
into `packages/core` with unit tests, following the current split.

- The game needs a full-screen view without the normal sidebar, and subroutes. The current
  `ModuleRoute` handles only `/skill/:skillId/:moduleId`. Small core changes are acceptable.
  Prefer a generic mechanism over guitar-specific code in the core.
- `ProgressApi` keeps data in localStorage, which is not safe for game progress. All game state
  goes into SQLite so backups cover it.
- New tables, schema left to the builder, must cover: practice sessions with real seconds, quest
  results (rating, metric, level at the time, XP), per-technique level and suggestion, daily quest
  selection, lesson state, inventory and equipped gear.
- XP, level and streak should derive from recorded results where practical, so formulas can change
  later without corrupting saves.
- Quest generation, difficulty suggestion, best-next and XP are pure tested functions. Date logic
  uses the local day, as `stats.ts` does.
- Existing songs and chord overrides remain untouched and usable.
- Old `/skill/guitar/...` URLs redirect into the game. E2E tests are updated.
- The game keeps its own look regardless of the app's light or dark setting.
- PC first: that is where practice happens (decided).
- **Phone companion (decided: some mobile support).** Short look-ups on a phone: songs, lessons,
  today's quests, status. Phone layout is responsive and simpler, with no village painting required
  and no full map interaction required. Builder's call: reach it over the home network through an
  explicit opt-in start command, because the app has no login and anyone on that network could
  open it. Default stays localhost only. Microphone features stay PC only, since browsers block the
  microphone on plain HTTP, so no HTTPS setup is needed. The phone needs the PC server running.
- **Audio input (decided: microphone first, audio interface later, untested).** Add an input device
  picker, so the interface works by selecting it. Turn off browser echo cancellation, noise
  suppression and auto gain for pitch detection. Provide an input level meter. Note finding must
  tolerate room noise and metronome bleed, and always offers the click fallback.

## Art and sound

- Source sprites are in `sprites/`: `forest_spritesheet.png`, `items_spritesheet.png`,
  `items2_spritesheet.webp`, `village.webp`.
- They carry a crayon watermark at bottom right, overlapping some cells (the boots, the last
  forest tile, the last flame). `items2_spritesheet.webp` has a baked-in solid background and no
  transparency. Build a repeatable cut script that outputs clean assets into the skill. Do not use
  cells damaged by the watermark, and crop the watermark from the village image.
- Sheets lack art for hills, peak, tower and library. Internet sources are allowed by the owner:
  only permissive licenses (CC0 preferred), with a credits file, and coherent with the existing
  pixel style.
- Pixel font loaded locally, not from a CDN, since the app runs local and offline as a PWA.
- Ambience and effects are optional, with a mute control. Audio is silent during quests, tuner and
  microphone use.

## Stages

1. **Foundation:** tables, tracking, full-screen shell, status bar, village, first launch, Quest
   Board, difficulty loop, Chord Change Trainer, metronome in quests, existing tools reachable.
   First usable daily routine. Existing 13 lessons work as quests.
2. **Map and first quarter:** skill tree, lesson panel, navigation, Tips Board, main road,
   cross-links, songs, plus all lessons for months 1-3 of the road, including palm muting and The
   Bard's Song preparation.
3. **Tools:** fretboard overlays and game, Tavern upgrades, Chronicle, Jam Room, riff viewer.
4. **Remaining lessons and story:** path by path, in main-road order.
5. **Rewards and polish:** Market, gear, ambience, final art pass.

From stage 2 the map shows every planned node, so the whole first year is visible. Lessons not
written yet appear as "in Vorbereitung" with title and description. Best next and quests never
point at them. This is the only exception to "any lesson can be opened", and it ends with stage 4.

Each stage ends working and usable.

## Left to the builder

Exact XP and level curve, level titles, quest mix rules, table schema, component structure, map
rendering approach, gear list, story writing, and the final lesson list per path. The mockup's 51
lessons are a starting sample, not a fixed list.

Mockups: `.superpowers/brainstorm/21487-1793824631/content/home-layout.html` (option A chosen) and
`skill-map.html`.
