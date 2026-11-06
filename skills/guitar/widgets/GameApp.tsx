import { Navigate, Route, Routes } from "react-router-dom";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { GAME_BASE } from "../game/api.js";
import "../game/game.css";
import { GameShell, PlacementGate } from "../game/GameShell.js";
import {
  Forge,
  FretboardPlace,
  Library,
  Market,
  Shrine,
  Tavern,
} from "../game/Places.js";
import { Chronicle } from "../game/chronicle/Chronicle.js";
import { JamRoom } from "../game/jam/JamRoom.js";
import { MapScreen } from "../game/map/MapScreen.js";
import { Riffs } from "../game/RiffViewer.js";
import { Placement } from "../game/Placement.js";
import { QuestBoard } from "../game/QuestBoard.js";
import { QuestView } from "../game/QuestView.js";
import { Village } from "../game/Village.js";

export default function GameApp(props: WidgetProps) {
  return (
    <div className="game-root">
      <Routes>
        <Route element={<GameShell />}>
          <Route element={<PlacementGate />}>
            <Route index element={<Village />} />
            <Route path="quests" element={<QuestBoard />} />
            <Route path="quest/:questId" element={<QuestView {...props} />} />
          </Route>
          <Route path="einstufung" element={<Placement {...props} />} />
          <Route path="taverne" element={<Tavern {...props} />} />
          <Route path="bibliothek" element={<Library />} />
          <Route path="bibliothek/:lessonId" element={<Library />} />
          {/* One optional segment, so selecting a node keeps the map and its zoom mounted. */}
          <Route path="hafen/:nodeId?" element={<MapScreen />} />
          <Route path="markt" element={<Market />} />
          <Route path="schrein" element={<Shrine {...props} />} />
          <Route path="schmiede" element={<Forge {...props} />} />
          <Route path="griffbrett" element={<FretboardPlace {...props} />} />
          <Route path="riffs" element={<Riffs />} />
          <Route path="jam" element={<JamRoom />} />
          <Route path="chronik" element={<Chronicle />} />
          <Route path="*" element={<Navigate to={GAME_BASE} replace />} />
        </Route>
      </Routes>
    </div>
  );
}
