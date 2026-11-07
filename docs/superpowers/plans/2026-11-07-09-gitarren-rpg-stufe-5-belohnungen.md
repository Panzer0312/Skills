# Guitar RPG Stage 5: Rewards and Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan. Tasks 1 to 6 run in parallel in one checkout; Task 7 runs after them. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Open the Market: gold earned from practice, cosmetic gear bought with it, unique items for milestones, gear shown in the status bar; add optional harbor ambience and effects with one mute control; finish the art with extra sprites, map landmarks and one look for all tool frames.

**Architecture:** The gear catalogue is code in `packages/core` so the server can check prices and slots; gold is derived like XP (earned from `game_log` minus prices stored on purchase), so formulas can change without corrupting saves. Milestone items are never stored: a milestone lesson done means the item is owned. Sound is synthesized with Web Audio, like the Jam Room, so no audio file needs a license; it is off by default and plays only on an allowlist of calm screens.

**Tech Stack:** TypeScript, React 18, TanStack Query, Hono, better-sqlite3, zod, Vitest, Testing Library, Playwright, Python Pillow for the cut script. No new npm dependencies.

**Spec:** `docs/superpowers/specs/2026-11-04-gitarren-rpg-design.md` (sections "Market and progression", "Art and sound", stage 5).

**Scope:** Stage 5 of 5. Baseline: 92 test files, 1293 tests, all passing. Stage 5 of 5, as assigned by the "Later stages" table of the stage 1 plan: Market, gear, milestone items, ambience with mute, extra CC0 art with credits. Also the carried stage 1 item "look of tool frames not unified (stage 5)".

## Global Constraints

- All site text German. Item and region names may stay English only where they already are; new item names are German.
- Gear is earned, never bought with real anything. Gear is cosmetic: it gives no gameplay advantage, never changes XP, quests or levels.
- Gold comes only from logged practice. No penalties, gold never goes negative, nothing is ever taken away.
- Game state in SQLite, not localStorage, including the sound setting. Local day logic.
- Ambience and effects are optional, off by default, with a mute control. Audio is silent during quests, tuner and microphone use, and in every tool that makes its own sound (metronome, trainer, Jam Room).
- New art only under permissive licenses, CC0 preferred, every external file listed in `skills/guitar/assets/CREDITS.md` with author, source URL and license. Original art drawn by script is fine and is credited as original. Coherent with the existing pixel style. Never use sheet cells damaged by the crayon watermark (bottom right of each sheet).
- Japanese, demo, review and Anki features stay unchanged.
- Stop `npm run dev` before e2e. Never write to `packages/server/data/app.db`.
- Work on `master`. Only the coordinator commits, because parallel workers share one checkout. Commit messages end with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
- Parallel workers edit only the files their task lists. If another file must change, report it instead.

## Review Focus

- A double click on "Kaufen", or two tabs buying at once, must charge once and never push gold below zero. Test in Task 1 (route, same item twice, two items whose sum exceeds gold).
- Milestone ownership follows the lesson: if the owner sets a milestone lesson back to `aktiv`, the equipped item must simply stop showing, never crash, and come back when the lesson is done again. Test in Task 1 (state filters `equipped` to owned) and Task 3.
- Turning sound on while on the village, then opening a quest, the Shrine or the Jam Room must stop the ambience at once, and coming back must resume it only if sound is still on. Test in Task 4.
- A reload with sound on must not throw on a suspended `AudioContext`; ambience starts on the first pointer event. Test in Task 4.
- A brand-new player (0 gold, nothing owned) and a player at road end (all milestone items) must both get a valid Market and status bar. Test in Task 3.

---

## Shared names

Every task uses these exactly.

New sprite names (Task 2 cuts them, Tasks 1 and 3 reference them):
`shield-wood`, `shield-blue`, `sword-ice`, `dagger`, `dagger-gold`, `staff-red`, `ring-gem`, `ring-fire`, `ring-pink`, `chest-blue`.

New landmark sprite names (Task 5): `hills`, `peak`, `tower`, `library`.

Gear slots, in display order: `kopf` "Kopf", `waffe` "Waffe", `schild` "Schild", `ring` "Ring", `talisman` "Talisman".

Catalogue (`GEAR` in core, Task 1). `price` means sold in the Market, `milestone` means granted when that lesson is `gelernt` or `gemeistert`, never sold:

| id | name | slot | sprite | price / milestone |
|---|---|---|---|---|
| eisenhelm | Eisenhelm | kopf | helm | 120 |
| wanderdolch | Wanderdolch | waffe | dagger | 30 |
| kurzschwert | Kurzschwert | waffe | sword | 80 |
| jagdbogen | Jagdbogen | waffe | bow | 100 |
| eisklinge | Eisklinge | waffe | sword-ice | 200 |
| goldener-dolch | Goldener Dolch | waffe | dagger-gold | milestone `07-akkordwechsel` |
| feuerstab | Feuerstab | waffe | staff-red | milestone `metal-ganzer-song` |
| rundschild | Rundschild | schild | shield-wood | 40 |
| eichenschild | Eichenschild | schild | shield | 90 |
| hafenwappen | Hafenwappen | schild | shield-blue | 180 |
| sonnenwappen | Sonnenwappen | schild | emblem | milestone `song-bards-ganz` |
| smaragdring | Smaragdring | ring | ring | 60 |
| saphirring | Saphirring | ring | ring-gem | 140 |
| flammenring | Flammenring | ring | ring-fire | milestone `11-pentatonik` |
| rosenring | Rosenring | ring | ring-pink | milestone `caged-g` |
| heiltrank | Heiltrank | talisman | potion | 15 |
| manatrank | Manatrank | talisman | mana | 15 |
| alter-schluessel | Alter Schlüssel | talisman | key | 20 |
| rubin | Rubin | talisman | ruby | 250 |
| barre-urkunde | Barre-Urkunde | talisman | parchment | milestone `10-barre` |
| zauberrolle | Zauberrolle | talisman | scroll | milestone `13-theorie` |
| feuerbeutel | Feuerbeutel | talisman | firebag | milestone `lead-erstes-solo` |
| truhe-der-strasse | Truhe der Straße | talisman | chest-blue | milestone `jam-frei` |

Each item also has a one-line German `description`; milestone items say which step earned them, without numbers or dates.

Gold rule: `goldForEntry(entry) = Math.floor(xpForEntry(entry) / 5)`. A 30-minute quest at level 3 pays about 30 gold, so the cheap items come in the first week and the Rubin after about two months.

---

### Task 1: Core gear rules and server

**Model:** sonnet.

**Files:**
- Create: `packages/core/src/game/gear.ts`, `packages/core/src/game/gear.test.ts`
- Modify: `packages/core/src/game/index.ts`, `packages/core/src/game/progression.ts`, `progression.test.ts`, `packages/core/src/game/api-types.ts`, `packages/server/src/db/client.ts`, `packages/server/src/routes/game.ts`, `packages/server/src/routes/game.test.ts`

**Interfaces (produces):**

```ts
export type GearSlot = "kopf" | "waffe" | "schild" | "ring" | "talisman";
export const GEAR_SLOTS: { id: GearSlot; name: string }[];
export interface GearItem { id: string; name: string; slot: GearSlot; sprite: string; description: string; price: number | null; milestone: string | null }
export const GEAR: GearItem[];                 // the catalogue above, in table order
export function gearItem(id: string): GearItem | undefined;
export function goldForEntry(entry: PracticeEntry): number;          // in progression.ts
export function ownedItems(purchased: string[], lessons: Record<string, LessonStatus>): string[];   // purchased ∪ milestones done, catalogue order, unknown ids dropped
export type BuyRefusal = "unbekannt" | "nicht-kaeuflich" | "schon-besessen" | "zu-wenig-gold";
export function buyCheck(itemId: string, gold: number, owned: string[]): BuyRefusal | null;
export const BUY_REFUSAL_TEXT: Record<BuyRefusal, string>;   // German: "Unbekannter Gegenstand", "Nur als Belohnung erhältlich", "Schon in deinem Besitz", "Nicht genug Gold"
```

`GameState` gains `gold: number`, `owned: string[]`, `equipped: Partial<Record<GearSlot, string>>`, `sound: boolean`. The log response gains `goldGained: number`.

- [ ] **Step 1: Core tests.** `gear.test.ts`: catalogue ids unique, every item has exactly one of `price` and `milestone`, prices positive integers; `ownedItems([], {})` is `[]`; `ownedItems([], {"10-barre": "gelernt"})` is `["barre-urkunde"]`; `"aktiv"` grants nothing; unknown purchased ids dropped; `buyCheck` returns each refusal and `null` for `buyCheck("wanderdolch", 30, [])`. `progression.test.ts`: `goldForEntry` of a 30-minute level 3 quest with rating is `Math.floor(xpForEntry(...)/5)`, of 0 seconds is 0.
- [ ] **Step 2:** Run `npx vitest run packages/core/src/game`; expect FAIL on missing exports. Implement; expect PASS.
- [ ] **Step 3: Tables** in `client.ts` schema: `game_inventory (skill_id TEXT NOT NULL, item_id TEXT NOT NULL, price INTEGER NOT NULL, acquired_at INTEGER NOT NULL, PRIMARY KEY (skill_id, item_id))`, `game_equipped (skill_id TEXT NOT NULL, slot TEXT NOT NULL, item_id TEXT NOT NULL, PRIMARY KEY (skill_id, slot))`, `game_settings (skill_id TEXT PRIMARY KEY, sound INTEGER NOT NULL DEFAULT 0)`.
- [ ] **Step 4: Route tests** in `game.test.ts`, then routes:
  - State: `gold = Σ goldForEntry(log rows) − Σ game_inventory.price`, `owned = ownedItems(purchased, lessons)`, `equipped` filtered to owned items, `sound` from `game_settings` (false when no row).
  - `POST /api/game/:skillId/market/buy` body `{ itemId }`. Inside one `raw.transaction`: compute gold and owned, `buyCheck`, insert with the item's price. Refusal: status 409, `{ error: BUY_REFUSAL_TEXT[r], reason: r }`. Success: `{ gold }`. Tests: buy works and lowers gold; second identical buy is 409 "schon-besessen" and gold drops once; two items whose sum exceeds gold: second is 409 "zu-wenig-gold"; milestone item 409 "nicht-kaeuflich"; unknown 409.
  - `PUT /api/game/:skillId/equip` body `{ slot, itemId: string | null }`. `itemId` must be owned and of that slot, else 400 with German error; `null` removes the row. Test: equip, replace, unequip, wrong slot 400, not owned 400, milestone item equips once its lesson is `gelernt`; after the lesson is set back to `aktiv` the state no longer lists it in `equipped`.
  - `PUT /api/game/:skillId/settings` body `{ sound: boolean }`, upsert. Test round trip.
  - `POST /log` response adds `goldGained`.
- [ ] **Step 5:** Run `npx vitest run packages/core packages/server`; expect PASS. Report; do not commit.

### Task 2: Gear sprites from the item sheet

**Model:** sonnet (needs to look at images).

**Files:** Modify `scripts/cut-sprites.py`, `skills/guitar/game/assets.ts`, `skills/guitar/game/assets.test.ts`. Create the ten PNGs of "Shared names" in `skills/guitar/assets/`.

- [ ] Find cells in `sprites/items2_spritesheet.webp` (1024×1024, solid background, keyed by the existing `cut` flood fill): `shield-wood` a round wooden shield (row 5), `shield-blue` the blue crest shield, `sword-ice` the large ice sword (row 4), `dagger` a plain steel dagger, `dagger-gold` the gold dagger (row 7), `staff-red` the red staff (row 4), `ring-gem` a blue gem ring (row 3), `ring-fire` a flame ring, `ring-pink` the pink gem ring (row 4), `chest-blue` the blue chest (row 4). Never a cell near the crayon at bottom right.
- [ ] Add boxes to the existing `ITEMS2` dict style. Run `python3 -I scripts/cut-sprites.py sprites skills/guitar/assets`. Open each new PNG and check: one whole object, transparent background, no neighbour pieces, no watermark. Existing PNGs must come out byte-identical or visually unchanged (`git diff --stat skills/guitar/assets`).
- [ ] Add the ten names to `SPRITE_NAMES`. Extend `assets.test.ts` so every name resolves; add a test that a corner pixel of each new sprite is transparent (closes the stage 1 open item "assets test does not assert transparency"), using the PNG decoder the test already uses or a minimal IHDR/tRNS check if none.
- [ ] Run `npx vitest run skills/guitar/game/assets.test.ts`. Report; do not commit.

### Task 3: Market screen, gear in the status bar, gold in the result

**Model:** sonnet.

**Files:**
- Create: `skills/guitar/game/market/Market.tsx`, `Market.test.tsx`, `market.css`, `skills/guitar/game/GearStrip.tsx`
- Modify: `skills/guitar/game/api.ts` (hooks), `skills/guitar/widgets/GameApp.tsx` (import `Market` from `../game/market/Market.js`), `skills/guitar/game/Places.tsx` (delete the stub), `skills/guitar/game/StatusBar.tsx`, `StatusBar.test.tsx`, `skills/guitar/game/ResultDialog.tsx`, `skills/guitar/game/Village.tsx` (drop the "öffnet bald" hint of the Market sign), `skills/guitar/game/GameShell.test.tsx` (market route asserts the new heading)

**Interfaces:** Consumes Task 1's `GEAR`, `GEAR_SLOTS`, `gearItem`, `buyCheck`, `BUY_REFUSAL_TEXT`, `GameState` fields and the three routes. Consumes `SoundToggle` from `./sound/SoundToggle.js` (Task 4). Sprite names from "Shared names"; `spriteUrl` takes `SpriteName`, so cast `item.sprite as SpriteName` (Task 2 adds them; the content test below proves it).

- [ ] `api.ts`: `useBuyItem()`, `useEquip()`, `useSoundSetting()` mutations, each invalidating the game state query. `LogResult` gains `goldGained`.
- [ ] `Market` inside `ToolFrame title="Markt"`: gold total with the `gold` sprite; section "Deine Ausrüstung" with one tile per slot (equipped item or "leer", click unequips); section "Händler" with purchasable items grouped by slot, each tile sprite, name, description, price, button "Kaufen" (disabled with the refusal text as visible hint when `buyCheck` refuses; "Gekauft" mark when owned, then "Anlegen" / "Angelegt"); section "Belohnungen" with milestone items, owned ones with "Anlegen", others greyed with "Verdient durch: <lesson title>" (title from `gameContent` nodes). A failed request shows the server's German error in a `role="alert"`, keeps the screen. Buttons disabled while a mutation is pending, so a double click sends once. After a successful buy call `playEffect("coin")` from `./sound/effects.js` (Task 4), and `playEffect("equip")` after equip.
- [ ] `market.css`: grid tiles in the game's pixel look, responsive to one column under 640px.
- [ ] `GearStrip` renders equipped sprites in slot order, each `img` with `alt` = item name, nothing when none. `StatusBar`: add `<GearStrip>` next to the level stat, a gold stat `<img gold> <b>{gold}</b> Gold`, change the total-time icon from `goldbag` to `parchment` so gold has one icon, and render `<SoundToggle />` before "Zum Dorf".
- [ ] `ResultDialog`: under `+N XP` show `+N Gold` when `goldGained > 0`.
- [ ] Tests (`Market.test.tsx`, `StatusBar.test.tsx`, with fetch mocked as the existing tests do and `vi.mock("../sound/effects.js")`): new player with 0 gold sees all trader buttons disabled with "Nicht genug Gold" and no crash; player with all milestone lessons `gelernt` sees all rewards with "Anlegen"; buy click sends one POST even on double click; 409 shows the alert text; equipped item shows in the status bar with its alt; `equipped` naming an item not in `GEAR` renders nothing. Content test in `skills/guitar/game/content.test.ts`: every `GEAR` sprite is in `SPRITE_NAMES` and every milestone is a road lesson.
- [ ] Run `npx vitest run skills/guitar/game`. Report; do not commit.

### Task 4: Sound: ambience, effects, mute

**Model:** sonnet.

**Files:** Create `skills/guitar/game/sound/ambience.ts`, `effects.ts`, `useAmbience.ts`, `SoundToggle.tsx`, `sound.test.ts`, `SoundToggle.test.tsx`. Modify `skills/guitar/game/GameShell.tsx` (call `useAmbience()` once).

**Interfaces (produces):**

```ts
export function ambienceAllowed(pathname: string): boolean;   // ambience.ts
export function startAmbience(ctx: AudioContext): () => void;  // returns stop
export function playEffect(kind: "coin" | "equip"): void;      // effects.ts; no-op unless sound is on and allowed
export function setSoundEnabled(on: boolean): void;            // effects.ts, module flag read by playEffect
export function useAmbience(): void;
export function SoundToggle(): JSX.Element;                    // button "Klang an" / "Klang aus", aria-pressed
```

- [ ] `ambienceAllowed`: true only for the game base itself (village), `markt`, `taverne`, `bibliothek[/…]`, `hafen[/…]`, `chronik`. False for `quests`, `quest/…`, `schrein`, `schmiede`, `griffbrett`, `riffs`, `jam`, `einstufung` and anything unknown. Match on the path segment after `GAME_BASE` from `../api.js`. Test every listed path.
- [ ] `startAmbience`: quiet harbor: brown noise through a lowpass near 500 Hz with a slow gain swell (waves, period 6 to 9 s), plus a soft bell partial every 20 to 40 s; master gain at most 0.08. Stop ramps down in 0.3 s and disconnects. `playEffect("coin")`: two short square blips (about 988 then 1319 Hz, 60 ms each); `"equip"`: a short low triangle thud. Both gain at most 0.15. Effects use their own short-lived context, closed after playing.
- [ ] `useAmbience`: reads `sound` from the game state and `useLocation`; calls `setSoundEnabled(sound && ambienceAllowed(path))`; runs ambience only while `sound && ambienceAllowed(path) && document.visibilityState === "visible"`. One `AudioContext`, created lazily; if it is `suspended`, resume on the first `pointerdown`, never throw. Leaving an allowed path stops at once; closing the context on unmount.
- [ ] `SoundToggle`: uses `useSoundSetting` from `../api.js` (Task 3 adds it; until then import it and let the coordinator wire it, reporting if missing). Shows the state, toggles, disabled while pending, default off.
- [ ] Tests with a fake `AudioContext` (stub class with `createGain`, `createBufferSource`, `createBiquadFilter`, `createOscillator`, `resume`, `close`, `state`): sound off never constructs a context; sound on at the village starts; navigating to `quest/x` stops; back to village restarts; navigating to `schrein` and `jam` stops; suspended context does not throw and resumes on pointerdown; `playEffect` does nothing while disabled.
- [ ] Run `npx vitest run skills/guitar/game/sound`. Report; do not commit.

### Task 5: Landmark art for the map

**Model:** sonnet, with web access.

**Files:** Create `skills/guitar/assets/hills.png`, `peak.png`, `tower.png`, `library.png`, and if drawn by script `scripts/draw-landmarks.py`. Modify `skills/guitar/assets/CREDITS.md`, `skills/guitar/game/map/SkillMap.tsx`, `skills/guitar/game/map/SkillMap.test.tsx`, `skills/guitar/game/map/map.css`. Do not touch `assets.ts` (Task 2 owns it): report the four names, the coordinator adds them.

- [ ] Look for CC0 pixel art first (Kenney.nl, OpenGameArt CC0 filter) for hills, a mountain peak, a stone tower and a library or scholar's building, top-down or 3/4 view, similar palette and pixel size to `skills/guitar/assets/oak.png`. Download into `$CLAUDE_JOB_DIR/tmp/art/` (its own empty folder), convert with Pillow outside that folder, scale with nearest neighbour to the existing sprites' scale. If nothing coherent is found within reasonable effort, draw original pixel sprites with `scripts/draw-landmarks.py` (Pillow, deterministic) in the same palette. Transparent background.
- [ ] `CREDITS.md`: one line per external file, author, URL, license; or "Original, gezeichnet mit scripts/draw-landmarks.py".
- [ ] `SkillMap.tsx`: one landmark per path, drawn once near the path's region center and behind nodes: `metal` → `peak`, `lead` → `hills`, `griffbrett` → `tower`, `theorie` → `library`. Add `LANDMARKS: Partial<Record<PathId, SpriteName>>` next to `SCENERY`; landmarks must not cover a node (reuse the overlap check of `scatter`). Test: each of the four paths renders exactly one landmark `image` with its sprite URL, and none overlaps a node box.
- [ ] Run `npx vitest run skills/guitar/game/map`. Report the four names and sources; do not commit.

### Task 6: One look for tool frames

**Model:** haiku.

**Files:** Modify `skills/guitar/game/Places.tsx` (only `ToolFrame`), `skills/guitar/game/game.css`.

- [ ] `ToolFrame` keeps its props. Replace the Tailwind light/dark classes on `.tool-frame-inner` with game styles in `game.css`: parchment panel (`#f3e6c4` background, `#3b2a1a` text, 3px dark brown pixel border with a 2px inset highlight), heading in the pixel font, same padding everywhere. The game keeps its own look regardless of the app's light or dark setting, so no `dark:` classes. Inputs, selects and buttons inside get one readable style (dark text on light, visible focus ring).
- [ ] Check every place that uses `ToolFrame` still reads well: run `npx vitest run skills/guitar` and open the Taverne, Schmiede, Schrein, Griffbrett, Jam Room and Chronik with `npm run dev` stopped afterwards (screenshots via Playwright, `npx playwright screenshot` against a dev server you start and stop yourself on a free port with a temp database through the e2e config's env). Report; do not commit.

### Task 7: Integrate, e2e, docs

**Model:** coordinator (opus), after Tasks 1 to 6.

- [ ] Add the four landmark names to `SPRITE_NAMES`. Wire anything a task reported as missing.
- [ ] `npm test && npm run build`; fix fallout.
- [ ] Create `e2e/guitar-market.spec.ts`: log a quest through the API until gold suffices, open Markt, buy "Wanderdolch", "Gold" total drops by 30, "Anlegen", the dagger shows in the status bar, reload keeps it; "Klang an" toggles and survives reload. Use the helpers in `e2e/guitar-helpers.ts`.
- [ ] Update `README.md` and `PROJECT_LOG.md` (deviations section for stage 5, "Offen" line: stage 5 done; ambience never heard by the owner).
- [ ] Final whole-change review (one reviewer, opus), then fixes, then `npm test && npm run build && npm run test:e2e` with `npm run dev` stopped. Commit.
