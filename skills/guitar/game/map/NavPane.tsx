import type { LessonStatus, MapNode, MapPath, RoadStep } from "@skills/core";
import { isDone } from "../api.js";
import { TIER_COLORS, type MapFilter } from "./SkillMap.js";

const QUARTERS = [1, 2, 3, 4];
const TIERS: { tier: MapFilter["tier"]; label: string }[] = [
  { tier: null, label: "Alle" },
  { tier: 1, label: "1-3" },
  { tier: 2, label: "4-6" },
  { tier: 3, label: "7-10" },
];

const monthsLabel = ([from, to]: RoadStep["months"]) => (from === to ? `Monat ${from}` : `Monate ${from}–${to}`);
const quarterOf = (step: RoadStep) => Math.ceil(step.months[0] / 3);

function PathRow({
  path,
  nodes,
  statuses,
  active,
  onClick,
}: {
  path: MapPath;
  nodes: MapNode[];
  statuses: Record<string, LessonStatus>;
  active: boolean;
  onClick: () => void;
}) {
  // Known songs are no lessons: nothing can ever finish them.
  const lessons = nodes.filter((node) => node.path === path.id && !node.knownSong);
  const done = lessons.filter((node) => isDone(statuses[node.id])).length;
  return (
    <button
      type="button"
      className="map-path"
      style={{ borderLeftColor: path.color }}
      aria-pressed={active}
      onClick={onClick}
    >
      <span>
        {path.title}
        <small>{path.subtitle}</small>
      </span>
      <span>
        {done}/{lessons.length}
      </span>
    </button>
  );
}

function Legend() {
  return (
    <ul className="map-legend">
      {(
        [
          [1, "Leicht, 1 bis 3"],
          [2, "Mittel, 4 bis 6"],
          [3, "Schwer, 7 bis 10"],
        ] as const
      ).map(([tier, label]) => (
        <li key={tier}>
          <i className="map-swatch" style={{ background: TIER_COLORS[tier] }} />
          {label}
        </li>
      ))}
      <li>
        <i className="map-swatch is-chosen" />
        Als Quest angenommen
      </li>
      <li>
        <span className="map-legend-mark is-star">★</span>Schneller Erfolg
      </li>
      <li>
        <span className="map-legend-mark is-road">┅</span>Hauptweg
      </li>
      <li>
        <span className="map-legend-mark is-link">┄</span>Verbindung zwischen Pfaden
      </li>
      <li>✓ geschafft · ◯ pulsiert: bester nächster Schritt</li>
    </ul>
  );
}

function RoadRow({
  step,
  node,
  status,
  current,
  onSelect,
}: {
  step: RoadStep;
  node: MapNode | undefined;
  status: LessonStatus | undefined;
  current: boolean;
  onSelect: (id: string) => void;
}) {
  return (
    <li>
      <button
        type="button"
        className="map-step"
        aria-current={current ? "step" : undefined}
        onClick={() => onSelect(step.lessonId)}
      >
        {isDone(status) ? "✓ " : ""}
        {node?.title ?? step.lessonId}
        <small>{monthsLabel(step.months)}</small>
      </button>
    </li>
  );
}

function FirstYear({
  road,
  nodes,
  statuses,
  bestId,
  onSelect,
}: {
  road: RoadStep[];
  nodes: MapNode[];
  statuses: Record<string, LessonStatus>;
  bestId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <details className="map-year">
      <summary>Das erste Jahr</summary>
      {QUARTERS.map((quarter) => (
        <div key={quarter}>
          <h4>
            {quarter}. Quartal, Monate {quarter * 3 - 2}–{quarter * 3}
          </h4>
          <ol>
            {road
              .filter((step) => quarterOf(step) === quarter)
              .map((step) => (
                <RoadRow
                  key={step.lessonId}
                  step={step}
                  node={nodes.find((node) => node.id === step.lessonId)}
                  status={statuses[step.lessonId]}
                  current={step.lessonId === bestId}
                  onSelect={onSelect}
                />
              ))}
          </ol>
        </div>
      ))}
    </details>
  );
}

export function NavPane({
  nodes,
  paths,
  road,
  statuses,
  bestId,
  filter,
  onFilter,
  onSelect,
}: {
  nodes: MapNode[];
  paths: MapPath[];
  road: RoadStep[];
  statuses: Record<string, LessonStatus>;
  bestId: string | null;
  filter: MapFilter;
  onFilter: (filter: MapFilter) => void;
  onSelect: (id: string) => void;
}) {
  return (
    <nav className="map-nav game-panel" aria-label="Karte navigieren">
      <input
        type="search"
        className="map-search"
        aria-label="Lektion suchen"
        placeholder="Lektion suchen"
        value={filter.term}
        onChange={(event) => onFilter({ ...filter, term: event.target.value })}
      />
      <div className="map-paths">
        {paths.map((path) => (
          <PathRow
            key={path.id}
            path={path}
            nodes={nodes}
            statuses={statuses}
            active={filter.path === path.id}
            onClick={() => onFilter({ ...filter, path: filter.path === path.id ? null : path.id })}
          />
        ))}
      </div>
      <div className="map-chips">
        {TIERS.map(({ tier, label }) => (
          <button
            key={label}
            type="button"
            className="game-button"
            aria-pressed={filter.tier === tier}
            onClick={() => onFilter({ ...filter, tier })}
          >
            {label}
          </button>
        ))}
      </div>
      <FirstYear road={road} nodes={nodes} statuses={statuses} bestId={bestId} onSelect={onSelect} />
      <Legend />
    </nav>
  );
}
