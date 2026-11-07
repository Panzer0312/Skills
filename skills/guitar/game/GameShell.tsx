import { useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { GAME_BASE, useGameState } from "./api.js";
import { PREFS_KEY } from "./api/prefs.js";
import { migrateLocalPrefs } from "./migrateLocalPrefs.js";
import { useIntroDismissed } from "./intro/dismissed.js";
import { IntroTour } from "./intro/IntroTour.js";
import { StatusBar } from "./StatusBar.js";
import { useAmbience } from "./sound/useAmbience.js";
import { usePref } from "./usePref.js";

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
      <IntroTour />
    </>
  );
}

/** First launch gates only the village and quest screens. Tool places stay outside this route. */
export function PlacementGate() {
  const state = useGameState();
  const [introSeen, , { loading }] = usePref("intro.gesehen");
  const dismissed = useIntroDismissed();
  const { pathname } = useLocation();
  if (state.isPending || loading) return <p className="game-note">Wird geladen…</p>;
  if (!state.data) return null;
  // Meister Orlo speaks first; the placement follows once the tour is done or skipped.
  // The tour starts in the village, so a deep link to a gated route goes there first.
  if (!introSeen && !dismissed && pathname !== GAME_BASE && pathname !== `${GAME_BASE}/`) {
    return <Navigate to={GAME_BASE} replace />;
  }
  if (!state.data.placed && (introSeen || dismissed)) return <Navigate to={`${GAME_BASE}/einstufung`} replace />;
  return <Outlet />;
}
