import { Navigate, Route, Routes } from "react-router-dom";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";
import { GAME_BASE } from "../game/api.js";
import "../game/game.css";
import { GameShell, PlacementGate } from "../game/GameShell.js";
import { Placement } from "../game/Placement.js";
import { PLACES, type PlaceDef } from "../game/placeRegistry.js";
import { QuestView } from "../game/QuestView.js";
import { Village } from "../game/Village.js";

function routesOf(places: PlaceDef[], props: WidgetProps) {
  return places.flatMap((place) =>
    (place.routes ?? [place.path]).map((path) => <Route key={path} path={path} element={place.element(props)} />),
  );
}

export default function GameApp(props: WidgetProps) {
  return (
    <div className="game-root">
      <Routes>
        <Route element={<GameShell />}>
          <Route element={<PlacementGate />}>
            <Route index element={<Village />} />
            {routesOf(
              PLACES.filter((place) => place.gated),
              props,
            )}
            <Route path="quest/:questId" element={<QuestView {...props} />} />
          </Route>
          <Route path="einstufung" element={<Placement {...props} />} />
          {routesOf(
            PLACES.filter((place) => !place.gated),
            props,
          )}
          <Route path="*" element={<Navigate to={GAME_BASE} replace />} />
        </Route>
      </Routes>
    </div>
  );
}
