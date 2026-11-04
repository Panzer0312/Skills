import { Navigate, Outlet } from "react-router-dom";
import { GAME_BASE, useGameState } from "./api.js";
import { StatusBar } from "./StatusBar.js";

export function GameShell() {
  const state = useGameState();
  return (
    <>
      <StatusBar state={state.data} />
      {state.isError ? (
        <div role="alert" className="game-error">
          <p>{state.error.message}</p>
          <button type="button" className="game-button" onClick={() => void state.refetch()}>
            Erneut versuchen
          </button>
        </div>
      ) : null}
      <main>
        <Outlet />
      </main>
    </>
  );
}

/** First launch gates only the village and quest screens. Tool places stay outside this route. */
export function PlacementGate() {
  const state = useGameState();
  if (state.isPending) return <p className="game-note">Wird geladen…</p>;
  if (!state.data) return null;
  if (!state.data.placed) return <Navigate to={`${GAME_BASE}/einstufung`} replace />;
  return <Outlet />;
}
