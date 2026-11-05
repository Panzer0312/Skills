# Guitar RPG Stage 2: Map and First Quarter Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Harbor's road list with a zoomable skill map of about 80 lessons on six differently shaped paths, with gold main road, quick wins, cross-links, song recommendations and a Tips Board, and write every lesson for months 1 to 3 of the road.

**Architecture:** `skills/guitar/game/map.json` is the single source for all planned lessons, written or not. Pure map, tip and selection rules live in `packages/core/src/game`. The map is hand-placed SVG with a pure viewport module. Lessons stay MDX and import guitar-only visual components directly, so the core MDX set stays untouched.

**Tech Stack:** TypeScript, React 18, React Router 6, TanStack Query, Hono, better-sqlite3, zod, MDX, Vitest, Testing Library, Playwright. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md`

**Scope:** Stage 2 of 5. Remaining lessons and story are stage 4. Metronome upgrades, fretboard overlays and Jam Room are stage 3. Hills, peak and tower art is stage 5, so regions use tints and existing sprites here.

## Global Constraints

- All instructions, tips, buttons and lesson text in German. Names of regions and titles may stay English.
- Nothing is hard-locked. The only exception: unwritten lessons appear as "in Vorbereitung" with title and description, and best next and quests never point at them.
- Lessons are ordered along each path by difficulty. Green 1-3, amber 4-6, red 7-10.
- At most three active lessons: the main-road lesson plus two chosen by the owner. Taking a fourth asks which one to pause.
- Best next always follows the gold road. Chosen lessons add to the board and never replace that recommendation.
- No commercial tabs or lyrics shipped. Song lessons use words, chord names and original exercises. All riffs and exercises are original.
- Every song recommendation is verified against a reliable source before shipping.
- Every lesson includes at least one visualization. Forward references to untaught concepts are avoided.
- Game state in SQLite. Japanese, demo, review and Anki features stay unchanged.
- Stop `npm run dev` before e2e. The e2e database is `packages/server/data/e2e.db`. Never touch `packages/server/data/app.db`, except read-only.
- Work on `master`. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.

## Review Focus

- A fourth lesson taken while two are chosen must ask which to pause and change nothing until answered. A chosen lesson that becomes `gelernt` must free its slot by itself.
- When every written lesson is finished but planned ones remain, the Tips Board and Quest Board must stay valid and say more lessons are coming, never pointing at an unwritten lesson.
- Zooming or dragging must never lose the map: the view stays clamped, the wheel does not scroll the page, and a reset button always works.
- A song lesson whose song is not imported, or imported with a different apostrophe or case, must still work: match loosely, and otherwise offer the import while its exercises stay usable.
- A player placed in stage 1 meets new lessons inserted before their position: best next points at the first unfinished written road step, with no crash and no lost progress.

---

## File Structure

```
packages/core/src/game/
  map.ts            map schema types, relations, roadPoints
  tips.ts           quickWin, buildTips
  quests.ts         modified: schema, bestNext, buildDailyQuests
  difficulty.ts     modified: scaleQuest sections and runs
  api-types.ts      modified: chosenLessons, quick
packages/server/src/routes/game.ts   modified: chosen, target song, quick
skills/guitar/game/
  map.json                            paths and all nodes
  map/viewport.ts                     pure zoom and pan
  map/SkillMap.tsx                    SVG map
  map/LessonPanel.tsx, NavPane.tsx, TipsBoard.tsx, MapScreen.tsx, map.css
  visuals/Griffbild.tsx, Tab.tsx, RhythmusRaster.tsx, GriffbrettBild.tsx, index.ts
skills/guitar/lessons/*.mdx           14 new lessons, visuals added to 01-09
```

---

### Task 1: Core rules for map, tips and selection

**Files:**
- Create: `packages/core/src/game/map.ts`, `packages/core/src/game/map.test.ts`, `packages/core/src/game/tips.ts`, `packages/core/src/game/tips.test.ts`
- Modify: `packages/core/src/game/quests.ts`, `quests.test.ts`, `difficulty.ts`, `difficulty.test.ts`, `index.ts`, `packages/core/src/index.ts`, `skills/guitar/game/content.test.ts`, `skills/guitar/game/api.ts`

**Interfaces:**
- Produces in `map.ts`, zod-backed like `quests.ts`:
```ts
type PathId = "hafen" | "rhythmus" | "fingerpicking" | "theorie" | "metal" | "lead" | "griffbrett";
interface MapPath { id: PathId; title: string; subtitle: string; color: string; label: { x: number; y: number } }
interface SongTip { title: string; artist: string; trains: string; source: string }
interface MapNode {
  id: string; title: string; description: string; path: PathId; rank: number;
  x: number; y: number; parent: string | null; quick: boolean; available: boolean;
  knownSong: boolean; techniqueId: string | null;
  links: { to: string; reason: string }[]; songs: SongTip[];
  targetSong: { title: string; artist: string } | null;
}
interface NodeRelations { buildsOn: MapNode[]; unlocks: MapNode[]; linked: { node: MapNode; reason: string }[] }
relations(nodes: MapNode[], id: string): NodeRelations      // links count in both directions
roadPoints(road: RoadStep[], nodes: MapNode[]): { x: number; y: number }[]
```
- `GameContent` gains `paths: MapPath[]` and `nodes: MapNode[]`. `RoadStep.questId` becomes `string | null`; null marks a planned step. `QuestScale` gains `sections?: string[]`, `runs?: [number, number]`. `ScaledQuest` gains `section: string | null`, `runs: number | null`.
- `bestNext` skips steps with `questId === null`.
- `buildDailyQuests` input gains `chosenLessonIds: string[]`.
- `parseGameContent` rejects dangling references with a German message: road `lessonId` and `questId`, node `parent`, `links[].to`, `techniqueId`, quest `lessonId` when it is not null must resolve (quest and road lesson ids must be node ids). It also rejects duplicate ids.
- Produces in `tips.ts`:
```ts
interface QuickTip { node: MapNode; refine: boolean }
interface Tips { best: RoadStep | null; quick: QuickTip | null; stayOnTrack: string; moreComing: boolean }
quickWin(nodes: MapNode[], statuses: Record<string, LessonStatus>): QuickTip | null
buildTips(content: GameContent, statuses: Record<string, LessonStatus>, chosen: string[]): Tips
```

Rules:
- `buildDailyQuests` order: best next, first `wechsel`, first quest of each chosen lesson, song, theory, warm-up, others not recent. Theory and warm-up slots choose in three tiers: unfinished, reached and not recent; reached and not recent; first of that kind. A quest is reached when its lesson is on the road at or before the best-next step, or the road is finished. This stops lesson 13 theory from reaching a player at lesson 07.
- `quickWin`: first available quick node that is `offen` or missing (`refine: false`), else first available quick node not `gemeistert` (`refine: true`), else null.
- `stayOnTrack` text: with two chosen lessons `"Zwei Nebenwege reichen. Bring erst einen davon zu Ende."`; with one `"Neben dem Hauptweg läuft ein Nebenweg. Das ist ein gutes Maß."`; with none `"Bleib beim Hauptweg und nimm dir bei Lust einen Nebenweg dazu."`
- `moreComing` is true when `best` is null and the road still has a planned step.
- `scaleQuest`: `section` picks `sections[floor((level - 1) / 10 * length)]`; `runs` scales linearly.

- [ ] **Step 1: Write the failing tests**

```ts
describe("relations", () => {
  it("finds parent, children and links in both directions", () => {
    const r = relations(nodes, "b");
    expect(r.buildsOn.map((n) => n.id)).toEqual(["a"]);
    expect(r.unlocks.map((n) => n.id)).toEqual(["c"]);
    expect(r.linked).toEqual([{ node: expect.objectContaining({ id: "x" }), reason: "weil" }]);
  });
});
describe("bestNext", () => {
  it("never points at a planned step", () => {
    expect(bestNext([step("a", null), step("b", "qb")], {})?.lessonId).toBe("b");
  });
  it("is null when only planned steps remain", () => {
    expect(bestNext([step("a", "qa"), step("b", null)], { a: "gelernt" })).toBeNull();
  });
});
describe("buildDailyQuests", () => {
  it("adds chosen lessons after the drill", () => {
    expect(build({ minutes: 30, chosenLessonIds: ["c"] }).slice(0, 3)).toEqual(["a", "wechsel", "qc"]);
  });
  it("keeps best next first when a chosen lesson is also on the road", () => {
    expect(build({ minutes: 30, chosenLessonIds: ["a"] })[0]).toBe("a");
  });
  it("does not offer theory beyond the road position", () => {
    expect(build({ minutes: 45 })).not.toContain("theorie-spaet");
  });
  it("rotates reached theory when all of it is finished", () => {
    expect(build({ minutes: 45, statuses: done, recentQuestIds: ["theorie-1"] })).toContain("theorie-2");
  });
});
describe("buildTips", () => {
  it("offers an open quick win first", () => expect(tips().quick).toMatchObject({ refine: false }));
  it("asks to refine a learned quick win", () => {
    expect(tips({ statuses: { q1: "gelernt" } }).quick).toMatchObject({ node: { id: "q1" }, refine: true });
  });
  it("drops a mastered quick win", () => expect(tips({ statuses: { q1: "gemeistert" } }).quick).toBeNull());
  it("skips unavailable quick wins");
  it("says more lessons are coming when only planned steps remain", () => {
    expect(tips({ statuses: allWritten })).toMatchObject({ best: null, moreComing: true });
  });
  it("changes the stay-on-track text with chosen lessons");
});
describe("parseGameContent", () => {
  it("rejects a link to an unknown node", () => expect(() => parse(badLink)).toThrow(/links/));
  it("rejects duplicate node ids", () => expect(() => parse(dupes)).toThrow(/mehrfach/));
});
describe("scaleQuest", () => {
  it("picks a later section at a higher level", () => {
    const quest = withScale({ sections: ["Intro", "Strophe"], runs: [2, 6] });
    expect(scaleQuest(quest, 1)).toMatchObject({ section: "Intro", runs: 2 });
    expect(scaleQuest(quest, 10)).toMatchObject({ section: "Strophe", runs: 6 });
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run packages/core/src/game`
Expected: FAIL.

- [ ] **Step 3: Implement**

`nodes` and `paths` are required in the schema. Until Task 3 lands, create `skills/guitar/game/map.json` with one node per existing lesson and road step (ids equal lesson ids, placeholder coordinates, `available: true`), so `api.ts` and `content.test.ts` keep working. `api.ts` passes `{ ...quests, road, ...map }`. Update the `content.test.ts` expectations that changed: a 10-minute session at lesson 07 no longer contains `stufenakkorde`.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages skills
git commit -m "feat(core): add map, tips and chosen-lesson rules"
```

---

### Task 2: Server support

**Files:**
- Modify: `packages/server/src/db/client.ts`, `packages/server/src/routes/game.ts`, `packages/server/src/routes/game.test.ts`, `packages/core/src/game/api-types.ts`, `packages/core/src/game/quests.ts`

**Interfaces:**
- Produces table:
```sql
CREATE TABLE IF NOT EXISTS game_chosen (skill_id TEXT NOT NULL, lesson_id TEXT NOT NULL, chosen_at INTEGER NOT NULL, PRIMARY KEY (skill_id, lesson_id));
```
- `GameState` gains `chosenLessons: string[]`, oldest first, excluding lessons that are `gelernt` or `gemeistert`.
- `LogBody` gains `quick?: boolean`. With `quick: true` and rating `passt` or `zu-leicht`, the lesson becomes `gelernt` unless already `gemeistert`.

| Route | Body | Result |
|---|---|---|
| `PUT /chosen/:lessonId` | `{ replace?: string }` | `{ ok: true }`, or 409 `{ error: { code: "limit", message } }` when two lessons are chosen, `replace` is absent and the lesson is not already chosen |
| `DELETE /chosen/:lessonId` | none | `{ ok: true }` |
| `PUT /target-song` | `{ targetSongId }`, same format as placement, null allowed | `{ ok: true }` |

The limit of two lives in `MAX_CHOSEN = 2`, exported from `packages/core/src/game/quests.ts`. Finished lessons do not count towards it. `replace` and the insert run in one transaction. Choosing moves an `offen` lesson to `aktiv`, as the spec says.

Also wrap the log insert, status change and record check of `POST /log` in one `raw.transaction` (deferred from stage 1).

- [ ] **Step 1: Write the failing tests**

```ts
it("lists chosen lessons oldest first");
it("moves an open lesson to aktiv when chosen");
it("refuses a third chosen lesson with 409 limit and changes nothing");
it("replaces a chosen lesson in one step");
it("accepts choosing an already chosen lesson again");
it("frees the slot when a chosen lesson is gelernt");      // third PUT succeeds afterwards
it("removes a chosen lesson with DELETE");
it("makes a quick lesson gelernt after one passing quest");
it("leaves a quick lesson aktiv after zu-schwer");
it("does not lower gemeistert through a quick log");
it("sets and clears the target song");
it("rejects a malformed target song id");
it("keeps chosen lessons apart per skill");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run packages/server/src/routes/game`
Expected: FAIL.

- [ ] **Step 3: Implement the routes**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run packages/server && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages
git commit -m "feat(server): add chosen lessons, quick wins and target song routes"
```

---

### Task 3: Map content and road for the whole year

**Files:**
- Modify: `skills/guitar/game/map.json`, `skills/guitar/game/road.json`, `skills/guitar/game/content.test.ts`, `skills/guitar/game/quests.json`

**Interfaces:**
- Consumes: Task 1 schema.
- Produces: final node ids. Stage 2 lessons, used verbatim by Tasks 8 to 10:

| Id | Title | Path | Rank | Quick |
|---|---|---|---|---|
| `rhythmus-ankerfinger` | Ankerfinger | rhythmus | 3 | |
| `rhythmus-achtel` | Achtel im Fluss | rhythmus | 3 | |
| `rhythmus-drei-akkorde` | Drei-Akkord-Song | rhythmus | 2 | yes |
| `metal-sound` | Amp und Gain | metal | 2 | |
| `metal-stumm` | Saiten stumm halten | metal | 3 | |
| `metal-palm-mute` | Palm Mute vertiefen | metal | 3 | |
| `metal-erster-riff` | Erster Riff in 15 Minuten | metal | 2 | yes |
| `metal-downpicking` | Downpicking-Ausdauer | metal | 4 | |
| `finger-daumen` | Daumen und Finger | fingerpicking | 2 | |
| `finger-arpeggio` | Arpeggio-Muster | fingerpicking | 3 | |
| `song-bards-vorbereitung` | The Bard's Song: Vorbereitung | fingerpicking | 5 | |
| `song-bards-ganz` | The Bard's Song: ganz spielen | fingerpicking | 5 | |
| `lead-drei-toene` | Solo aus drei Tönen | lead | 2 | yes |
| `jam-ein-akkord` | Jam über einen Akkord | griffbrett | 2 | yes |

Paths and shapes, from the approved mockup `.superpowers/brainstorm/21487-1793824631/content/skill-map.html`, which also holds a starting set of 51 nodes, positions and 12 cross-links. Map space is 1600 by 1100.

| Path | Region title | Subtitle | Shape | Nodes |
|---|---|---|---|---|
| `hafen` | Harbor of Beginnings | Grundlagen | short chain at the centre | 5 (lessons 01 to 05) |
| `rhythmus` | Forest of Changes | Rhythmus | branching tree, left | 14 |
| `fingerpicking` | Bard's Grove | Fingerpicking | winding vine, upper left | 12 |
| `theorie` | Star Library | Theorie und Gehör | constellation, top | 11 |
| `metal` | Iron Hills | Metal | jagged zigzag, upper right | 14 |
| `lead` | Dragon Peak | Lead | spiral, lower right | 13 |
| `griffbrett` | Tower of CAGED | Griffbrett und Jam | ring of five shapes, then a branch, bottom | 13 |

That is about 80 lessons plus three `knownSong` nodes on Fingerpicking and Rhythm: `song-rising-sun`, `song-nothing-else-matters`, `song-creep`. They are `available: false`, have no lesson, and exist so placement can mark them.

Existing lessons map to: 06, 07, 08, 10 on `rhythmus`; 09 on `metal`; 11, 12 on `lead`; 13 on `theorie`. Each path's nodes rise in `rank` from the Harbor outwards along every parent chain. Quick nodes hang off a main node by a short side branch.

At least 20 cross-links with German reasons, including the 12 of the mockup. Include `metal-palm-mute` to funk muting, `10-barre` to the E shape, `finger-arpeggio` to sweep arpeggios, and `07-akkordwechsel` to `song-bards-vorbereitung`.

`road.json` order for months 1 to 3: 01, 02, 03, 04, 05 (month 1); 06, 07, `rhythmus-ankerfinger` (months 1 to 2); 08, `rhythmus-achtel`, 09, `metal-sound`, `metal-stumm`, `metal-palm-mute` (month 2); `finger-daumen`, `finger-arpeggio`, `song-bards-vorbereitung`, `song-bards-ganz` (months 2 to 3); `metal-downpicking` (months 3 to 4). Then 10, 11, 12, 13 and planned steps following the spec's table for months 4 to 12. New steps have `questId: null` and `available: false` until Tasks 8 to 10 write them. Every step has a German `reason`.

Add two theory quests so the theory slot can rotate: `noten-e-saite` on lesson 03, `akkordtoene` on lesson 06, each 5 minutes, kind `theorie`, technique `theorie`. Add techniques `fingerpicking`, `metal`, `jam`.

- [ ] **Step 1: Extend `content.test.ts`**

```ts
it("plans about eighty lessons", () => {
  const lessons = gameContent.nodes.filter((n) => !n.knownSong);
  expect(lessons.length).toBeGreaterThanOrEqual(78);
  expect(lessons.length).toBeLessThanOrEqual(84);
});
it("marks a node available exactly when its lesson file exists");
it("rises in rank along every parent chain");            // child.rank >= parent.rank
it("keeps every parent on the same path, or the Harbor");
it("hangs quick nodes on a parent and keeps them at rank 3 or below");
it("keeps nodes at least 56 units apart");
it("keeps estimated labels from overlapping");           // 6.4 units per character, 16 high, below the node
it("keeps all nodes inside 1600 by 1100");
it("has at least twenty cross-links, each with a reason");
it("covers every available lesson on the road or as a quick win");
it("orders road months without going backwards");
it("gives every written road step a quest and every planned step none");
it("starts a placed stage-1 player at the first unfinished written step");
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run skills/guitar/game/content`
Expected: FAIL.

- [ ] **Step 3: Write the content**

Hand-place all nodes. A small throwaway script in the scratchpad may help find overlaps. Do not commit it.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): plan all first-year lessons on six paths"
```

---

### Task 4: Lesson visuals

**Files:**
- Create: `skills/guitar/game/visuals/Griffbild.tsx`, `Tab.tsx`, `RhythmusRaster.tsx`, `GriffbrettBild.tsx`, `index.ts`, `visuals.test.tsx`
- Modify: `skills/guitar/lessons/01-haltung.mdx` to `09-powerchords.mdx`, `skills/guitar/lessons/lessons.test.ts`

**Interfaces:**
- Produces, imported in MDX with `import { Tab } from "../game/visuals/index.js"`:
```ts
Griffbild(props: { akkorde: string[] })            // ChordDiagramSingle per name, with user overrides
Tab(props: { titel?: string; zeilen: string[] })   // six strings, monospaced, high e on top, labelled
RhythmusRaster(props: { muster: string; zaehlzeiten?: string[] })
  // one cell per character: D down, U up, x muted, - rest. Default counts 1 + 2 + 3 + 4 +
GriffbrettBild(props: { punkte: { saite: number; bund: number; text?: string }[]; bis?: number })
  // saite 1 = high e, 6 = low E; bis defaults to 5
```
All are readable in light and dark and have an `aria-label` in German summarising the picture.

`lessons.test.ts` drops the "thirteen lessons" and strict chain rules. It keeps the block check for every lesson, and adds: every lesson has a unique `order`; every `requires` is null or an existing id; every lesson on road months 1 to 3 imports at least one visual; no lesson contains a `Tab` wider than 40 characters per line.

Add at least one visual to each of lessons 01 to 09, matching what the text teaches. Fix nothing else in those lessons, except wrong facts, which go in the report.

- [ ] **Step 1: Write the failing tests**

```tsx
it("draws one cell per pattern character", () => {
  render(<RhythmusRaster muster="D-DU-UDU" />);
  expect(screen.getAllByTestId("rhythmus-zelle")).toHaveLength(8);
});
it("rejects an unknown pattern character visibly");     // shows "Ungültiges Muster"
it("shows six labelled strings with high e first");
it("marks fretted notes at string and fret");
it("uses a chord override in Griffbild");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run skills/guitar/game/visuals skills/guitar/lessons`
Expected: FAIL.

- [ ] **Step 3: Implement the components and edit the lessons**

- [ ] **Step 4: Verify**

Run: `npm test && npm run build`
Expected: PASS, and the MDX imports resolve in the build.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): add lesson visuals and use them in the first lessons"
```

---

### Task 5: The map itself

**Files:**
- Create: `skills/guitar/game/map/viewport.ts`, `viewport.test.ts`, `SkillMap.tsx`, `SkillMap.test.tsx`, `map.css`

**Interfaces:**
- Produces:
```ts
interface View { x: number; y: number; width: number; height: number }
const FULL_VIEW: View  // 0, 0, 1600, 1100
zoomAt(view: View, factor: number, point: { x: number; y: number }): View
panBy(view: View, dx: number, dy: number): View
clampView(view: View): View        // width between 400 and 1600, aspect kept, inside the map

<SkillMap nodes paths road statuses selectedId bestId filter onSelect />
interface MapFilter { path: PathId | null; tier: 1 | 2 | 3 | null; term: string }
```
Rendering:
- Layers in order: region tints, decorative sprites, parent lines, gold road (`roadPoints`, thick dashed), quick side paths in dotted gold, cross-links in dashed purple, nodes, labels.
- Nodes colour by rank tier, show rank or a check for `gelernt` and `gemeistert` (double check). Quick nodes are stars. Unavailable nodes are grey with dashed outline. `aktiv` has a ring. Best next pulses, respecting `prefers-reduced-motion`.
- Selecting a node highlights its relations and brightens its cross-links.
- Labels show at width at or below 900, or for the selected, best and hovered node, and for filter matches. Region titles always show.
- Each node is keyboard reachable: `tabIndex={0}`, `role="button"`, `aria-label` with title, status and difficulty, Enter and Space select.
- Filter dims non-matching nodes to 0.22 opacity, never removes them.
- Controls: zoom in, zoom out, "Ganze Karte". Wheel zooms at the cursor with a non-passive listener and `preventDefault`. Dragging pans, and a drag under 4 pixels counts as a click.

- [ ] **Step 1: Write the failing tests**

```ts
it("keeps the point under the cursor fixed while zooming");
it("clamps zoom at both ends", () => {
  expect(zoomAt(FULL_VIEW, 4, c).width).toBe(1600);          // cannot exceed the map
  expect(zoomAt(zoomAt(FULL_VIEW, 0.1, c), 0.1, c).width).toBe(400);
});
it("cannot pan outside the map");
```
```tsx
it("draws every node with a keyboard-reachable button");
it("selects a node with Enter");
it("shows done, quick and unavailable nodes differently");
it("marks best next");
it("dims nodes outside the filter without removing them");
it("returns to the whole map with Ganze Karte");
it("does not select after a drag");
it("prevents the page from scrolling on wheel");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run skills/guitar/game/map`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run skills/guitar/game/map`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): draw the zoomable skill map"
```

---

### Task 6: Map screen with panels

**Files:**
- Create: `skills/guitar/game/map/MapScreen.tsx`, `LessonPanel.tsx`, `NavPane.tsx`, `TipsBoard.tsx`, `MapScreen.test.tsx`
- Modify: `skills/guitar/widgets/GameApp.tsx`, `skills/guitar/game/Places.tsx`, `skills/guitar/game/api.ts`, `skills/guitar/game/map/map.css`, `skills/guitar/game/GameShell.test.tsx`

**Interfaces:**
- Consumes: Tasks 1, 2, 5.
- Produces routes `hafen` and `hafen/:nodeId`, replacing `Harbor`. Adds to `gameApi`: `chooseLesson(id, replace?)`, `pauseLesson(id)`, `setTargetSong(id | null)`. `chooseLesson` rethrows `ApiError` with code `limit`.

Layout on desktop, three columns as in the mockup: NavPane, map, right column with LessonPanel above TipsBoard. Below 640 px the map is hidden: NavPane, then a list of the chosen path's nodes, then the panel. Tips Board comes first there.

**NavPane:** search, one row per path with done count and total, difficulty chips Alle, 1-3, 4-6, 7-10, legend, and a collapsible "Das erste Jahr" list of road steps grouped by quarter with the current step marked. Clicking selects on the map.

**LessonPanel** for the selected node, defaulting to best next:
- Title, region, description, rank.
- Written lesson: "Lektion öffnen", and "Als Quest annehmen" or "Pausieren". On the best-next lesson the button is replaced by "Hauptweg".
- Unavailable: "In Vorbereitung". No action.
- `techniqueId` set: slider "Deine Stufe", 1 to 10, calling `setLevel`.
- "Baut auf", "Schaltet frei", and `<details open>` "Verbindungen (n)", each entry a button selecting that node plus its reason.
- "Songs dafür" list when `songs` is not empty, with title, artist, what it trains. Hidden otherwise.
- Quick node at `gelernt`: "Schneller Erfolg geschafft. Komm zurück und verfeinere ihn."
- `targetSong`: shows "Als Zielsong setzen" when an imported song matches, "Ist dein Zielsong" when set, and otherwise a link to `/songs/neu` with "Importiere den Song, die Übungen funktionieren auch ohne".

Match with `normalizeTitle(s: string): string`, exported from `skills/guitar/game/api.ts`: lowercase, straight apostrophes, collapsed spaces, trimmed.

On `limit`, a dialog lists the two chosen lessons: "Welche Lektion pausierst du?". Picking one calls `chooseLesson(id, replace)`. Cancel changes nothing.

**TipsBoard** from `buildTips`: "Bester nächster Schritt" with reason, link selecting it; "Schneller Erfolg" (or "Verfeinern") with link; "Bleib auf Kurs". With `moreComing`: "Alle fertigen Lektionen auf dem Hauptweg sind geschafft. Weitere folgen."

The Library route gets a fix from stage 1: `bibliothek/:lessonId` renders only that lesson's folder, and opening a lesson from the list updates the URL.

- [ ] **Step 1: Write the failing tests**

```tsx
it("opens best next in the panel by default");
it("opens a node from hafen/:nodeId");
it("shows Hauptweg instead of a take button on best next");
it("takes a lesson as quest");
it("asks which lesson to pause at the limit and changes nothing on cancel");
it("replaces the picked lesson at the limit");
it("shows in Vorbereitung without actions for an unwritten lesson");
it("saves the personal level from the slider");
it("selects a linked lesson from the connections list");
it("hides the songs block when a lesson has none");
it("reminds to refine a learned quick win");
it("offers the import when the target song is missing");
it("matches a curly apostrophe and other case as the same song");
it("filters by search and difficulty");
it("counts progress per path");
it("shows the coming-soon note when written lessons are finished");
it("shows a list instead of the map on a narrow screen");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run skills/guitar/game/map/MapScreen`
Expected: FAIL.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Check in a browser**

Screenshot the map at 1400 and 390 px with a Playwright script writing to the session scratchpad. Fix collisions and overflow.

- [ ] **Step 5: Run tests, then commit**

Run: `npm test && npm run typecheck`
Expected: PASS.

```bash
git add skills
git commit -m "feat(guitar): add lesson panel, navigation and Tips Board to the map"
```

---

### Task 7: Quests, placement and song sections follow the map

**Files:**
- Modify: `skills/guitar/game/useTodaySet.ts`, `QuestBoard.tsx`, `QuestView.tsx`, `ResultDialog.tsx`, `Placement.tsx`, `quests.json`, and their tests

**Interfaces:**
- Consumes: Tasks 1, 2.

Changes:
- `useTodaySet` passes `state.chosenLessons` to `buildDailyQuests`. Taking or pausing a lesson does not rebuild an existing day's set: the board shows "Morgen dabei" beside a newly chosen lesson's name in a "Nebenwege" line, plus a button "Heute dazunehmen" that appends its quest.
- Board rows and the quest view get a link to `hafen/:lessonId`.
- `QuestBoard` disables length and add buttons on `saving || writing` (parked race from stage 1).
- `ResultDialog` sends `quick: true` when the quest's lesson is a quick node.
- `QuestView` for kind `song` shows scaled section and run count: "Abschnitt: Strophe · 3 Durchläufe · 70 % Tempo". `song-ziel` gets `sections: ["Intro", "Strophe", "Refrain", "Bridge", "Ganzer Song"]` and `runs: [2, 5]`.
- `Placement` step 1 lists every available node in road order, then a heading "Songs, die du schon spielst" with the `knownSong` nodes, then quick nodes. Checked ones go into `knownLessonIds`.

- [ ] **Step 1: Write the failing tests**

```tsx
it("includes chosen lessons in a fresh set");
it("does not rebuild today's set when a lesson is taken");
it("appends a chosen lesson's quest with Heute dazunehmen");
it("blocks board writes while the village build runs");
it("sends quick for a quick-win quest");
it("shows section, runs and tempo on a song quest");
it("lists known songs in the placement and saves them");
it("links a board row to its map node");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run skills/guitar/game`
Expected: FAIL on the new tests.

- [ ] **Step 3: Implement**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test && npm run typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): feed chosen lessons and song sections into quests"
```

---

### Task 8: Rhythm lessons and quick wins

**Files:**
- Create: `skills/guitar/lessons/rhythmus-ankerfinger.mdx`, `rhythmus-achtel.mdx`, `rhythmus-drei-akkorde.mdx`, `lead-drei-toene.mdx`, `jam-ein-akkord.mdx`
- Modify: `skills/guitar/game/map.json`, `road.json`, `quests.json`

Every lesson in Tasks 8 to 10 follows these rules:
- `meta`: `id` equal to the node id, German `title`, unique `order` from 101 up, `requires: null`.
- Blocks `<Ziel>`, `<Handhaltung>`, `<Fehlerbild>`, `<Uebung>`, `<Checkpoint>`, as `lessons.test.ts` demands, and at least one visual.
- A quest in `quests.json` with `techniqueId`, a declared `scale` and German description. Set the node's `available: true` and the road step's `questId`.
- Style of `07-akkordwechsel.mdx`: direct, concrete, short. No concept before it is taught: check against the road order.

Content:
- `rhythmus-ankerfinger`: fingers that stay down or slide between Am-C, C-G (with its common fingering), Em-G. Diagrams of each pair. Quest kind `wechsel` is not reused; kind `technik`, `techniqueId: akkordwechsel`, BPM [50, 90].
- `rhythmus-achtel`: counting 1 + 2 +, hand moving constantly, ghost strokes. `RhythmusRaster` for three patterns. `techniqueId: rhythmus`, BPM [60, 100].
- `rhythmus-drei-akkorde` (quick): play a bundled practice song from `songs/uebungsstuecke.json` with chords already known, in about 15 minutes. `techniqueId: akkordwechsel`.
- `lead-drei-toene` (quick): an original phrase with three notes of A minor pentatonic, shown with `GriffbrettBild`. `techniqueId: lead`.
- `jam-ein-akkord` (quick): free phrases over a steady Em rhythm with the metronome. Note that the Jam Room comes later only as a neutral remark with no promise of a date. `techniqueId: jam`.

- [ ] **Step 1: Run the content tests to see the gap**

Run: `npx vitest run skills/guitar`
Expected: PASS, with these nodes still `available: false`.

- [ ] **Step 2: Add a failing check**

In `content.test.ts`, add the five ids to a `WRITTEN_IN_STAGE_2` list, and assert each is available, has a quest, and is on the road or quick. Tasks 9 and 10 extend the list.

Run: `npx vitest run skills/guitar/game/content`
Expected: FAIL.

- [ ] **Step 3: Write the lessons and quests**

- [ ] **Step 4: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): add rhythm lessons and three quick wins"
```

---

### Task 9: Metal lessons

**Files:**
- Create: `skills/guitar/lessons/metal-sound.mdx`, `metal-stumm.mdx`, `metal-palm-mute.mdx`, `metal-erster-riff.mdx`, `metal-downpicking.mdx`
- Modify: `skills/guitar/game/map.json`, `road.json`, `quests.json`, `content.test.ts`

Lesson rules are those of Task 8.

Content:
- `metal-sound`: gain, EQ, volume, why less gain sounds tighter and clearer, a safe starting point. Hearing protection and moderate volume. Visual: `Tab` of a short original test phrase to judge the sound. `techniqueId: metal`, no BPM.
- `metal-stumm`: muting unused strings with both hands, what noise gain adds. `GriffbrettBild` showing which fingers touch which strings. `techniqueId: metal`, BPM [60, 100].
- `metal-palm-mute`: deepens lesson 09: open versus muted notes, accents, pressure levels. An original exercise as `Tab`. `techniqueId: metal`, BPM [70, 120], metric label "Sauberes Tempo (BPM)", `masteryTarget: 120`.
- `metal-erster-riff` (quick): an original riff on the low strings with power chords and palm mute, about 15 minutes. `Tab`. `techniqueId: metal`, BPM [70, 110].
- `metal-downpicking`: only downstrokes, relaxed wrist, stamina in short bursts, stop on pain. `Tab`, `RhythmusRaster`. `techniqueId: metal`, BPM [80, 160], metric label "Sauberes Tempo (BPM)", `masteryTarget: 160`.

Each metric quest shows its number field in the result dialog through `metricLabel`, with no code change.

- [ ] **Step 1: Add the five ids to `WRITTEN_IN_STAGE_2`**

Run: `npx vitest run skills/guitar/game/content`
Expected: FAIL.

- [ ] **Step 2: Write the lessons and quests**

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills
git commit -m "feat(guitar): add the first metal lessons"
```

---

### Task 10: Fingerpicking and The Bard's Song

**Files:**
- Create: `skills/guitar/lessons/finger-daumen.mdx`, `finger-arpeggio.mdx`, `song-bards-vorbereitung.mdx`, `song-bards-ganz.mdx`
- Modify: `skills/guitar/game/map.json`, `road.json`, `quests.json`, `content.test.ts`

Lesson rules are those of Task 8.

Content:
- `finger-daumen`: thumb on bass strings, fingers on treble strings, on an electric guitar with or without pick. `GriffbrettBild` of the string assignment. `techniqueId: fingerpicking`, BPM [50, 90].
- `finger-arpeggio`: three original patterns over Em, Am, C, G. `Tab`. `techniqueId: fingerpicking`, BPM [50, 90]. It may mention that House of the Rising Sun and Nothing Else Matters use this idea, as the owner already plays both.
- `song-bards-vorbereitung`: read the chord names from the owner's imported sheet, read-only: `SELECT content FROM songs WHERE id = 3` on `packages/server/data/app.db`. Ship chord names and section words only, never lyrics or a transcription of the part. Original exercises for the hardest changes, with `Griffbild`. The owner quit after the intro, so start exactly there: what comes next and which change is hardest. `techniqueId: song`, quest `bards-wechsel`, kind `technik`, BPM [50, 90].
- `song-bards-ganz`: section by section, tempo plan, first full run. `targetSong: { title: "The Bard's Song", artist: "Blind Guardian" }` on both nodes. Quest `bards-ganz`, kind `song`, `techniqueId: song`, with `sections`, `runs: [1, 4]` and `tempoPercent: [50, 100]`.

- [ ] **Step 1: Add the four ids to `WRITTEN_IN_STAGE_2`, and a guard against pasted sheets**

The guard reads no database: it asserts both `song-bards-*` lessons contain no `{start_of_verse}` and no text line with bracketed chords in ChordPro style. Checking for lyrics is a review item.

Run: `npx vitest run skills/guitar/game/content`
Expected: FAIL.

- [ ] **Step 2: Write the lessons and quests**

- [ ] **Step 3: Run tests and build**

Run: `npm test && npm run build`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add skills
git commit -m "feat(guitar): add fingerpicking and The Bard's Song lessons"
```

---

### Task 11: Songs for this

**Files:**
- Modify: `skills/guitar/game/map.json`, `skills/guitar/game/content.test.ts`, `skills/guitar/game/Places.tsx`, `skills/guitar/game/GameShell.test.tsx`

**Interfaces:**
- Produces: `SongRecommendations`, a Tavern section "Empfehlungen" listing all `songs` of written nodes, grouped by lesson, with a link to `hafen/:nodeId`.

Add recommendations only where a real match exists, at least 12 across written and planned nodes, weighted to metal because that is the owner's goal. Each has German `trains` naming the technique, and `source` with the URL used to verify it. Verify each claim with a web search. Candidates to verify, dropping any that fail: Paranoid and Iron Man (Black Sabbath) for power chords; Master of Puppets (Metallica) for downpicking; Enter Sandman (Metallica) for palm muting; Zombie (The Cranberries) for chord changes Em, C, G, D; Knockin' on Heaven's Door (Bob Dylan) for G, D, Am, C; Dust in the Wind (Kansas) for Travis picking.

Name songs only, with no tabs, no lyrics.

- [ ] **Step 1: Write the failing tests**

```ts
it("recommends at least twelve songs with a source URL", () => {
  const songs = gameContent.nodes.flatMap((n) => n.songs);
  expect(songs.length).toBeGreaterThanOrEqual(12);
  for (const song of songs) expect(song.source).toMatch(/^https:\/\//);
});
```
```tsx
it("lists recommendations in the Tavern, grouped by lesson");
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run skills/guitar/game`
Expected: FAIL.

- [ ] **Step 3: Research, add the entries, build the Tavern section**

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add skills
git commit -m "feat(guitar): recommend songs by technique"
```

---

### Task 12: End to end and docs

**Files:**
- Create: `e2e/guitar-map.spec.ts`
- Modify: `PROJECT_LOG.md`, `README.md`, `docs/skills-authoring.md`

- [ ] **Step 1: Write the end-to-end tests**

```ts
test("the map opens on best next and a lesson can be taken as quest", async ({ page }) => {
  // reach the board as e2e/guitar-game.spec.ts does, go to the Harbor
  // the panel shows the best next lesson; select a quick win from the Tips Board
  // Als Quest annehmen; the board shows it under Nebenwege
});
test("a third side lesson asks which one to pause", async ({ page }) => {});
test("an unwritten lesson offers no way in", async ({ page }) => {
  // pick a planned node through search; expect "In Vorbereitung", no Lektion öffnen
});
test("zooming and Ganze Karte keep the map on screen", async ({ page }) => {});
```
Make the spec independent of order and of data from earlier runs, for example by pausing chosen lessons through the API first.

- [ ] **Step 2: Run everything**

Run: `rm -f packages/server/data/e2e.db* && npm test && npm run typecheck && npm run build && npm run test:e2e`
Expected: all PASS, with no dev server running.

- [ ] **Step 3: Check by eye**

Walk the map, panels and two new lessons at 1400 and 390 px. Fix what looks broken.

- [ ] **Step 4: Update docs**

`PROJECT_LOG.md`, in German: stage 2 status and decisions: `map.json` is the source for all planned lessons, chosen lessons live in `game_chosen`, guitar visuals are imported in MDX. `README.md`: lesson count and map. `docs/skills-authoring.md`: that an MDX lesson may import skill-local components.

- [ ] **Step 5: Commit**

```bash
git add e2e PROJECT_LOG.md README.md docs/skills-authoring.md
git commit -m "test(guitar): cover the skill map end to end"
```

---

## Review notes for the executor

Tasks 8, 9 and 10 each get a task reviewer told to check musical facts and German wording, line by line, as the Japanese course needed. Task 11's reviewer spot-checks three sources. Lyric and transcription checks for Task 10 are read against the owner's sheet.

## Later stages

Unchanged from the stage 1 plan: 3 Tools, 4 remaining lessons and story, 5 rewards and polish. Stage 1 deferred items not covered here stay in project memory.
