import { Navigate, Route, Routes } from "react-router-dom";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { GAME_BASE } from "../game/api.js";
import "../game/game.css";
import { GameShell, PlacementGate } from "../game/GameShell.js";
import {
  Chronicle,
  Forge,
  FretboardPlace,
  Harbor,
  Library,
  Market,
  Shrine,
  Tavern,
} from "../game/Places.js";
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
          <Route path="hafen" element={<Harbor />} />
          <Route path="markt" element={<Market />} />
          <Route path="schrein" element={<Shrine {...props} />} />
          <Route path="schmiede" element={<Forge {...props} />} />
          <Route path="griffbrett" element={<FretboardPlace {...props} />} />
          <Route path="chronik" element={<Chronicle />} />
          <Route path="*" element={<Navigate to={GAME_BASE} replace />} />
        </Route>
      </Routes>
    </div>
  );
}
