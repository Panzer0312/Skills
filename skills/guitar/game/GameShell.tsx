import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { GAME_BASE, useGameState } from "./api.js";
import { PREFS_KEY } from "./api/prefs.js";
import { migrateLocalPrefs } from "./migrateLocalPrefs.js";
import { StatusBar } from "./StatusBar.js";
import { useAmbience } from "./sound/useAmbience.js";

export function GameShell() {
  const state = useGameState();
  useAmbience();
  const client = useQueryClient();
  useEffect(() => {
    void migrateLocalPrefs().then((wrote) => {
      if (wrote) void client.invalidateQueries({ queryKey: PREFS_KEY });
    });
  }, [client]);
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
