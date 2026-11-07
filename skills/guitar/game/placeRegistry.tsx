import type { ReactElement } from "react";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import type { SpriteName } from "./assets.js";
import { Chronicle } from "./chronicle/Chronicle.js";
import { JamRoom } from "./jam/JamRoom.js";
import { MapScreen } from "./map/MapScreen.js";
import { Market } from "./market/Market.js";
import { Forge, FretboardPlace, Library, Shrine, Tavern } from "./Places.js";
import { QuestBoard } from "./QuestBoard.js";
import { Riffs } from "./RiffViewer.js";
import { Studierstube } from "./settings/Studierstube.js";

export interface PlaceDef {
  id: string;
  /** Link target below GAME_BASE. */
  path: string;
  /** Route patterns below GAME_BASE; defaults to [path]. */
  routes?: string[];
  label: string;
  hint: string;
  sprite: SpriteName;
  element: (props: WidgetProps) => ReactElement;
  inMenu: boolean;
  /** Inside the PlacementGate. */
  gated: boolean;
  /** Calm place where ambience may play. */
  ambience?: boolean;
}

export const PLACES: PlaceDef[] = [
  {
    id: "quests",
    path: "quests",
    label: "Quest Board",
    hint: "Quests wählen",
    sprite: "scroll",
    element: () => <QuestBoard />,
    inMenu: false,
    gated: true,
  },
  {
    id: "taverne",
    path: "taverne",
    label: "Tavern",
    hint: "deine Songs",
    sprite: "chest",
    element: (p) => <Tavern {...p} />,
    inMenu: false,
    gated: false,
  },
  {
    id: "bibliothek",
    path: "bibliothek",
    routes: ["bibliothek", "bibliothek/:lessonId"],
    label: "Library",
    hint: "Lektionen",
    sprite: "scroll",
    element: () => <Library />,
    inMenu: false,
    gated: false,
    ambience: true,
  },
  {
    id: "hafen",
    path: "hafen",
    // One optional segment, so selecting a node keeps the map and its zoom mounted.
    routes: ["hafen/:nodeId?"],
    label: "Harbor",
    hint: "die Reise",
    sprite: "ring",
    element: () => <MapScreen />,
    inMenu: false,
    gated: false,
    ambience: true,
  },
  {
    id: "markt",
    path: "markt",
    label: "Market",
    hint: "Ausrüstung",
    sprite: "chest",
    element: () => <Market />,
    inMenu: false,
    gated: false,
    ambience: true,
  },
  {
    id: "schrein",
    path: "schrein",
    label: "Shrine",
    hint: "Stimmgerät",
    sprite: "ring",
    element: (p) => <Shrine {...p} />,
    inMenu: true,
    gated: false,
  },
  {
    id: "schmiede",
    path: "schmiede",
    label: "Forge",
    hint: "Akkordgriffe",
    sprite: "sword",
    element: (p) => <Forge {...p} />,
    inMenu: true,
    gated: false,
  },
  {
    id: "griffbrett",
    path: "griffbrett",
    label: "Tower of CAGED",
    hint: "Griffbrett",
    sprite: "bow",
    element: (p) => <FretboardPlace {...p} />,
    inMenu: true,
    gated: false,
  },
  {
    id: "riffs",
    path: "riffs",
    label: "Riffs",
    hint: "Tabs zum Üben",
    sprite: "shield",
    element: () => <Riffs />,
    inMenu: true,
    gated: false,
  },
  {
    id: "jam",
    path: "jam",
    label: "Jam Room",
    hint: "Begleitung",
    sprite: "potion",
    element: () => <JamRoom />,
    inMenu: true,
    gated: false,
  },
  {
    id: "chronik",
    path: "chronik",
    label: "Chronicle",
    hint: "dein Fortschritt",
    sprite: "parchment",
    element: () => <Chronicle />,
    inMenu: true,
    gated: false,
    ambience: true,
  },
  {
    id: "studierstube",
    path: "studierstube",
    label: "Studierstube",
    hint: "Einstellungen",
    sprite: "key",
    element: () => <Studierstube />,
    inMenu: true,
    gated: false,
  },
];

/**
 * First path segments where ambience may play ("" is the village), and those
 * that also allow deeper subpaths. Same semantics as ALLOWED / ALLOWED_WITH_SUBPATH in sound/ambience.ts.
 */
export function ambiencePaths(): {
  paths: Set<string>;
  withSubpath: Set<string>;
} {
  const calm = PLACES.filter((p) => p.ambience);
  return {
    paths: new Set(["", ...calm.map((p) => p.path)]),
    withSubpath: new Set(calm.filter((p) => (p.routes ?? [p.path]).some((r) => r.includes("/"))).map((p) => p.path)),
  };
}
