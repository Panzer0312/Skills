import { buildTips, type GameState, type LessonStatus, type MapNode } from "@skills/core";
import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { GAME_BASE, gameContent, useGameState } from "../api.js";
import { LessonPanel } from "./LessonPanel.js";
import "./map.css";
import { NavPane } from "./NavPane.js";
import { matches, SkillMap, statusLabel, TIER_COLORS, tierOf, type MapFilter } from "./SkillMap.js";
import { TipsBoard } from "./TipsBoard.js";

const NO_FILTER: MapFilter = { path: null, tier: null, term: "" };

/** What the map shows below 640 px. */
function NodeRows({
  nodes,
  statuses,
  chosen,
  bestId,
  selectedId,
  onSelect,
}: {
  nodes: MapNode[];
  statuses: Record<string, LessonStatus>;
  chosen: string[];
  bestId: string | null;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="map-rows">
      {nodes.length === 0 ? <p className="game-note">Keine Lektion gefunden.</p> : null}
      <ul aria-label="Lektionen dieses Pfads">
        {nodes.map((node) => (
          <li key={node.id}>
            <button
              type="button"
              className="map-row"
              aria-pressed={node.id === selectedId}
              onClick={() => onSelect(node.id)}
            >
              <i className="map-swatch" style={{ background: TIER_COLORS[tierOf(node.rank)] }} />
              <span>
                {node.title}
                <small>
                  Schwierigkeit {node.rank} · {statusLabel(node, statuses[node.id], chosen.includes(node.id) || node.id === bestId)}
                </small>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MapView({ state }: { state: GameState }) {
  const { nodes, paths, road } = gameContent;
  const { nodeId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState(NO_FILTER);
  const stage = useRef<HTMLDivElement>(null);
  const panelBox = useRef<HTMLDivElement>(null);

  const tips = buildTips(gameContent, state.lessons, state.chosenLessons);
  const bestId = tips.best?.lessonId ?? null;
  const selected =
    nodes.find((node) => node.id === nodeId) ??
    nodes.find((node) => node.id === bestId) ??
    nodes.find((node) => node.path === "hafen")!;

  function select(id: string) {
    navigate(`${GAME_BASE}/hafen/${id}`, { replace: true });
    // Without the map the panel sits below the lists, so a tap would seem to do nothing.
    if (stage.current?.offsetParent === null) panelBox.current?.scrollIntoView?.();
  }

  const term = filter.term.trim().toLowerCase();
  const unfiltered = filter.path === null && filter.tier === null && term === "";
  const listFilter = unfiltered ? { ...filter, path: selected.path } : filter;

  return (
    <div className="map-screen">
      <h1 className="sr-only">Hafen</h1>
      <NavPane
        nodes={nodes}
        paths={paths}
        road={road}
        statuses={state.lessons}
        bestId={bestId}
        filter={filter}
        onFilter={setFilter}
        onSelect={select}
      />
      <div className="map-stage" ref={stage}>
        <SkillMap
          nodes={nodes}
          paths={paths}
          road={road}
          statuses={state.lessons}
          chosen={state.chosenLessons}
          selectedId={selected.id}
          bestId={bestId}
          filter={filter}
          onSelect={select}
        />
      </div>
      <NodeRows
        nodes={nodes.filter((node) => matches(node, listFilter, term))}
        statuses={state.lessons}
        chosen={state.chosenLessons}
        bestId={bestId}
        selectedId={selected.id}
        onSelect={select}
      />
      <div className="map-side">
        <div className="map-panel-box" ref={panelBox}>
          <LessonPanel
            key={selected.id}
            node={selected}
            nodes={nodes}
            paths={paths}
            state={state}
            best={tips.best}
            onSelect={select}
          />
        </div>
        <TipsBoard tips={tips} nodes={nodes} onSelect={select} />
      </div>
    </div>
  );
}

export function MapScreen() {
  const { data: state } = useGameState();
  return state ? <MapView state={state} /> : null;
}
