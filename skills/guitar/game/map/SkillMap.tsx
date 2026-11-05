import { relations, type LessonStatus, type MapNode, type MapPath, type PathId, type RoadStep } from "@skills/core";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { spriteUrl, type SpriteName } from "../assets.js";
import "./map.css";
import { centerOn, FULL_VIEW, panBy, pixelsPerUnit, screenToMap, viewCenter, zoomAt, type View } from "./viewport.js";

export interface MapFilter {
  path: PathId | null;
  tier: 1 | 2 | 3 | null;
  term: string;
}

export interface SkillMapProps {
  nodes: MapNode[];
  paths: MapPath[];
  road: RoadStep[];
  statuses: Record<string, LessonStatus>;
  selectedId: string | null;
  bestId: string | null;
  filter: MapFilter;
  onSelect: (id: string) => void;
}

const LABEL_MAX_WIDTH = 900;
const DIMMED = 0.22;
const DRAG_PIXELS = 4;
const BUTTON_ZOOM = 0.7;
const NODE_RADIUS = 14;
const REGION_RADIUS = 115;
const BIG_LABEL_SCALE = 19 / 13.5;
const TITLE_SIZE = 26;
export const TIER_COLORS = { 1: "#5f9e3f", 2: "#d08a1d", 3: "#b23a2e" } as const;
const UNAVAILABLE_FILL = "#77756c";

export const tierOf = (rank: number) => (rank <= 3 ? 1 : rank <= 6 ? 2 : 3);

export function matches(node: MapNode, filter: MapFilter, term: string): boolean {
  return (
    (filter.path === null || node.path === filter.path) &&
    (filter.tier === null || tierOf(node.rank) === filter.tier) &&
    node.title.toLowerCase().includes(term)
  );
}

function starPoints(x: number, y: number): string {
  return Array.from({ length: 10 }, (_, i) => {
    const radius = i % 2 ? 7.5 : 16;
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    return `${(x + radius * Math.cos(angle)).toFixed(1)},${(y + radius * Math.sin(angle)).toFixed(1)}`;
  }).join(" ");
}

interface Box {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface Sprite {
  name: SpriteName;
  x: number;
  y: number;
  width: number;
  height: number;
}

// Pixel size of each sprite, and how tall it stands on the map.
const SPRITES: Partial<Record<SpriteName, { size: [number, number]; height: number }>> = {
  pine: { size: [93, 182], height: 58 },
  pine2: { size: [97, 185], height: 62 },
  oak: { size: [163, 181], height: 58 },
  birch: { size: [87, 182], height: 54 },
  mushroom: { size: [77, 62], height: 18 },
  log: { size: [90, 71], height: 20 },
  stump: { size: [85, 76], height: 24 },
};

// What grows in each region, and how much of it.
const SCENERY: Record<PathId, { sprites: SpriteName[]; density: number }> = {
  hafen: { sprites: ["log", "birch", "mushroom"], density: 0.3 },
  rhythmus: { sprites: ["pine", "pine2", "oak", "birch", "pine", "mushroom"], density: 0.85 },
  fingerpicking: { sprites: ["birch", "oak", "birch", "mushroom", "log"], density: 0.7 },
  theorie: { sprites: ["mushroom", "birch", "stump"], density: 0.3 },
  metal: { sprites: ["stump", "log", "pine2", "stump"], density: 0.45 },
  lead: { sprites: ["stump", "log", "stump", "mushroom"], density: 0.4 },
  griffbrett: { sprites: ["oak", "stump", "log", "mushroom"], density: 0.45 },
};

const overlaps = (a: Box, b: Box) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

/** The estimate content.test.ts checks collisions on. */
function labelBox(node: MapNode, scale = 1): Box {
  const half = (node.title.length * 6.4 * scale) / 2;
  return { left: node.x - half, right: node.x + half, top: node.y + 16, bottom: node.y + 32 };
}

function nodeBoxes(node: MapNode): Box[] {
  return [labelBox(node), { left: node.x - 18, right: node.x + 18, top: node.y - 18, bottom: node.y + 18 }];
}

/** The view itself, or moved just enough to centre a node outside it. */
function reveal(view: View, node: MapNode): View {
  const inside = node.x > view.x && node.x < view.x + view.width && node.y > view.y && node.y < view.y + view.height;
  return inside ? view : centerOn(view, node);
}

function titleBox(path: MapPath): Box {
  const width = Math.max(path.title.length * 12, path.subtitle.length * 9);
  return { left: path.label.x, right: path.label.x + width, top: path.label.y - 24, bottom: path.label.y + 26 };
}

/** True when the segment comes near the box, sampled along the line. */
function lineHits(a: MapNode, b: MapNode, box: Box): boolean {
  const steps = Math.ceil(Math.hypot(a.x - b.x, a.y - b.y) / 8);
  for (let i = 0; i <= steps; i += 1) {
    const x = a.x + ((b.x - a.x) * i) / steps;
    const y = a.y + ((b.y - a.y) * i) / steps;
    if (x > box.left - 6 && x < box.right + 6 && y > box.top - 6 && y < box.bottom + 6) return true;
  }
  return false;
}

function seeded(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/** Sprites on a jittered grid around each path, the same on every render. */
function scatter(nodes: MapNode[], paths: MapPath[]): Sprite[] {
  const random = seeded(7);
  const byId = new Map(nodes.map((node) => [node.id, node]));
  const blocked = [...nodes.flatMap(nodeBoxes), ...paths.map(titleBox)];
  const lines = nodes.flatMap((node) => {
    const parent = node.parent ? byId.get(node.parent) : undefined;
    return parent ? [[node, parent] as const] : [];
  });
  const sprites: Sprite[] = [];
  const placed: Box[] = [];
  for (let gridY = 30; gridY < FULL_VIEW.height; gridY += 44) {
    for (let gridX = 20; gridX < FULL_VIEW.width; gridX += 44) {
      const x = gridX + random() * 30;
      const y = gridY + random() * 30;
      const roll = random();
      const pick = random();
      const nearest = nodes.reduce<{ node: MapNode | null; distance: number }>(
        (best, node) => {
          const distance = Math.hypot(node.x - x, node.y - y);
          return distance < best.distance ? { node, distance } : best;
        },
        { node: null, distance: Infinity },
      );
      if (!nearest.node || nearest.distance > 120) continue;
      const scenery = SCENERY[nearest.node.path];
      if (roll > scenery.density) continue;
      const name = scenery.sprites[Math.floor(pick * scenery.sprites.length)] as SpriteName;
      const art = SPRITES[name];
      if (!art) continue;
      const height = art.height;
      const width = (height * art.size[0]) / art.size[1];
      const box = { left: x - width / 2, right: x + width / 2, top: y - height, bottom: y };
      if (box.left < 0 || box.right > FULL_VIEW.width || box.top < 0 || box.bottom > FULL_VIEW.height) continue;
      if (blocked.some((other) => overlaps(box, other))) continue;
      if (placed.some((other) => overlaps(box, other))) continue;
      if (lines.some(([a, b]) => lineHits(a, b, box))) continue;
      placed.push(box);
      sprites.push({ name, x: box.left, y: box.top, width, height });
    }
  }
  // Painter's order: what stands lower on the map is in front.
  return sprites.sort((a, b) => a.y + a.height - (b.y + b.height));
}

/** Soft tints from gradient circles: a blur filter costs far too much on every pan frame. */
function Regions({ nodes, paths }: { nodes: MapNode[]; paths: MapPath[] }) {
  return (
    <g data-layer="regions">
      <defs>
        {paths.map((path) => (
          <radialGradient key={path.id} id={`map-tint-${path.id}`}>
            <stop offset="0" stopColor={path.color} stopOpacity={0.42} />
            <stop offset="0.55" stopColor={path.color} stopOpacity={0.3} />
            <stop offset="1" stopColor={path.color} stopOpacity={0} />
          </radialGradient>
        ))}
      </defs>
      {nodes.map((node) => (
        <circle key={node.id} cx={node.x} cy={node.y} r={REGION_RADIUS} fill={`url(#map-tint-${node.path})`} />
      ))}
    </g>
  );
}

function Decor({ sprites }: { sprites: Sprite[] }) {
  return (
    <g data-layer="decor">
      {sprites.map((sprite, i) => (
        <image key={i} className="map-sprite" href={spriteUrl(sprite.name)} x={sprite.x} y={sprite.y} width={sprite.width} height={sprite.height} />
      ))}
    </g>
  );
}

export function SkillMap({ nodes, paths, road, statuses, selectedId, bestId, filter, onSelect }: SkillMapProps) {
  const [view, setView] = useState<View>(FULL_VIEW);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const drag = useRef<{ pointerId: number; x: number; y: number; view: View; moved: boolean } | null>(null);
  const ignoreClick = useRef(false);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const pixels = event.deltaMode === WheelEvent.DOM_DELTA_LINE ? event.deltaY * 16 : event.deltaY;
      const factor = Math.exp(Math.max(-200, Math.min(200, pixels)) * 0.002);
      const box = svg.getBoundingClientRect();
      setView((current) => zoomAt(current, factor, screenToMap(current, box, event.clientX, event.clientY)));
    };
    // React registers wheel listeners as passive, so preventDefault needs its own.
    svg.addEventListener("wheel", onWheel, { passive: false });
    return () => svg.removeEventListener("wheel", onWheel);
  }, []);

  const scenery = useMemo(
    () => (
      <>
        <Regions nodes={nodes} paths={paths} />
        <Decor sprites={scatter(nodes, paths)} />
      </>
    ),
    [nodes, paths],
  );

  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const related = useMemo(() => {
    if (!selectedId) return new Set<string>();
    const { buildsOn, unlocks, linked } = relations(nodes, selectedId);
    return new Set([...buildsOn, ...unlocks, ...linked.map((link) => link.node)].map((node) => node.id));
  }, [nodes, selectedId]);

  // The nav pane and the Tips Board select nodes the zoomed view may not show.
  useEffect(() => {
    const node = selectedId ? byId.get(selectedId) : undefined;
    if (node) setView((current) => reveal(current, node));
  }, [selectedId, byId]);

  const term = filter.term.trim().toLowerCase();
  const filtering = filter.path !== null || filter.tier !== null || term !== "";
  const isMatch = (node: MapNode) => !filtering || matches(node, filter, term);
  const dim = (...ends: MapNode[]) => (ends.every(isMatch) ? undefined : DIMMED);
  const touchesSelected = (a: MapNode, b: MapNode) => a.id === selectedId || b.id === selectedId;

  const withParent = nodes.flatMap((node) => {
    const parent = node.parent ? byId.get(node.parent) : undefined;
    return parent ? [{ node, parent }] : [];
  });
  // A road step joins its parent, not the step before it: the road changes
  // region often, and straight hops between regions would cross the whole map.
  const roadLines = road.flatMap((step) => withParent.filter(({ node }) => node.id === step.lessonId));
  const links = nodes.flatMap((from) =>
    from.links.flatMap((link) => {
      const to = byId.get(link.to);
      return to ? [{ from, to }] : [];
    }),
  );

  const called = (node: MapNode) => node.id === selectedId || node.id === bestId || node.id === hoveredId;
  const labelled = (node: MapNode) => view.width <= LABEL_MAX_WIDTH || called(node) || (filtering && isMatch(node));
  const shownLabels = nodes.filter(labelled);
  // On the whole map a label at its zoomed size is too small to read, so the
  // called-out ones grow, unless that would run them into another label.
  const scaleOf = (node: MapNode) => (called(node) ? BIG_LABEL_SCALE : 1);
  const bigLabel = (node: MapNode) =>
    view.width > LABEL_MAX_WIDTH &&
    called(node) &&
    !shownLabels.some((other) => other !== node && overlaps(labelBox(node, BIG_LABEL_SCALE), labelBox(other, scaleOf(other))));
  // Titles shrink as the map grows under them, so they never take over a zoomed view.
  const titleSize = TITLE_SIZE * Math.sqrt(view.width / FULL_VIEW.width);

  function onPointerDown(event: PointerEvent<SVGSVGElement>) {
    ignoreClick.current = false;
    if (event.button !== 0) return;
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, view, moved: false };
  }

  function onPointerMove(event: PointerEvent<SVGSVGElement>) {
    const current = drag.current;
    if (!current || event.pointerId !== current.pointerId) return;
    const dx = event.clientX - current.x;
    const dy = event.clientY - current.y;
    if (!current.moved) {
      if (Math.hypot(dx, dy) < DRAG_PIXELS) return;
      // Captured only now: capturing on pointer down would send the click of a
      // plain press to the svg instead of the node.
      current.moved = true;
      ignoreClick.current = true;
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    const scale = pixelsPerUnit(current.view, event.currentTarget.getBoundingClientRect()) || 1;
    setView(panBy(current.view, -dx / scale, -dy / scale));
  }

  function endDrag() {
    drag.current = null;
  }

  function onNodeKeyDown(event: KeyboardEvent, id: string) {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onSelect(id);
  }

  function onNodeFocus(node: MapNode) {
    setHoveredId(node.id);
    setView((current) => reveal(current, node));
  }

  return (
    <div className="skill-map">
      <svg
        ref={svgRef}
        role="group"
        aria-label="Lernkarte"
        viewBox={`${view.x} ${view.y} ${view.width} ${view.height}`}
        preserveAspectRatio="xMidYMid meet"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
      >
        <rect className="map-ground" width={FULL_VIEW.width} height={FULL_VIEW.height} />
        {scenery}

        <g data-layer="parents">
          {withParent
            .filter(({ node }) => !node.quick)
            .map(({ node, parent }) => (
              <line
                key={node.id}
                className={`map-parent${touchesSelected(node, parent) ? " is-on" : ""}`}
                x1={parent.x}
                y1={parent.y}
                x2={node.x}
                y2={node.y}
                opacity={dim(node)}
              />
            ))}
        </g>

        <g data-layer="road">
          {roadLines.map(({ node, parent }) => (
            <line key={node.id} className="map-road" x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} opacity={dim(node)} />
          ))}
        </g>

        <g data-layer="quick">
          {withParent
            .filter(({ node }) => node.quick)
            .map(({ node, parent }) => (
              <line key={node.id} className="map-quick" x1={parent.x} y1={parent.y} x2={node.x} y2={node.y} opacity={dim(node)} />
            ))}
        </g>

        <g data-layer="links">
          {links.map(({ from, to }) => (
            <line
              key={`${from.id}-${to.id}`}
              className={`map-link${touchesSelected(from, to) ? " is-on" : ""}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              opacity={dim(from, to)}
            />
          ))}
        </g>

        <g data-layer="nodes">
          {nodes.map((node) => {
            const status = statuses[node.id] ?? "offen";
            const tierColor = TIER_COLORS[tierOf(node.rank)];
            const best = node.id === bestId;
            const shape = {
              className: "map-shape",
              fill: !node.available ? UNAVAILABLE_FILL : node.quick ? "#ffd34d" : tierColor,
              stroke: node.available ? "#1c1009" : node.quick ? "#ffd34d" : tierColor,
              strokeDasharray: node.available ? undefined : node.quick ? "4 2" : "6 4",
            };
            const classes = ["map-node", node.id === selectedId && "is-selected", related.has(node.id) && "is-related"];
            return (
              <g
                key={node.id}
                className={classes.filter(Boolean).join(" ")}
                tabIndex={0}
                role="button"
                aria-label={`${node.title}, ${node.available ? status : "in Vorbereitung"}, Schwierigkeit ${node.rank} von 10${best ? ", beste nächste Lektion" : ""}`}
                aria-pressed={node.id === selectedId}
                opacity={isMatch(node) ? undefined : DIMMED}
                onClick={() => {
                  if (!ignoreClick.current) onSelect(node.id);
                }}
                onKeyDown={(event) => onNodeKeyDown(event, node.id)}
                onFocus={() => onNodeFocus(node)}
                onBlur={() => setHoveredId(null)}
                onPointerEnter={() => setHoveredId(node.id)}
                onPointerLeave={() => setHoveredId(null)}
              >
                {best && <circle className="map-best-pulse" cx={node.x} cy={node.y} r={NODE_RADIUS + 7} />}
                <circle className="map-focus" cx={node.x} cy={node.y} r={NODE_RADIUS + 9} />
                {node.id === selectedId && <circle className="map-selected-ring" cx={node.x} cy={node.y} r={NODE_RADIUS + 6} />}
                {status === "aktiv" && <circle className="map-active-ring" cx={node.x} cy={node.y} r={NODE_RADIUS + 4} />}
                {node.quick ? (
                  <polygon {...shape} points={starPoints(node.x, node.y)} />
                ) : (
                  <circle {...shape} cx={node.x} cy={node.y} r={NODE_RADIUS} />
                )}
                <text className="map-rank" x={node.x} y={node.y + 4.5}>
                  {status === "gemeistert" ? "✓✓" : status === "gelernt" ? "✓" : node.rank}
                </text>
              </g>
            );
          })}
        </g>

        <g data-layer="labels">
          {shownLabels.map((node) => (
            <text
              key={node.id}
              className={`map-label${bigLabel(node) ? " is-big" : ""}`}
              x={node.x}
              y={node.y + (bigLabel(node) ? 31 : 28)}
              textAnchor="middle"
              opacity={isMatch(node) ? undefined : DIMMED}
            >
              {node.title}
            </text>
          ))}
        </g>

        <g data-layer="titles">
          {paths.map((path) => (
            <text key={path.id} className="map-title" x={path.label.x} y={path.label.y} fontSize={titleSize}>
              {path.title}
              <tspan className="map-subtitle" x={path.label.x} dy="1em">
                {path.subtitle}
              </tspan>
            </text>
          ))}
        </g>
      </svg>

      <div className="map-controls">
        <button type="button" className="game-button" aria-label="Hineinzoomen" onClick={() => setView((v) => zoomAt(v, BUTTON_ZOOM, viewCenter(v)))}>
          +
        </button>
        <button type="button" className="game-button" aria-label="Herauszoomen" onClick={() => setView((v) => zoomAt(v, 1 / BUTTON_ZOOM, viewCenter(v)))}>
          −
        </button>
        <button type="button" className="game-button" onClick={() => setView(FULL_VIEW)}>
          Ganze Karte
        </button>
      </div>
    </div>
  );
}
