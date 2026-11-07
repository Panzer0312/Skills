import { useRef, useState } from "react";
import { ApiError } from "../../../packages/web/src/api/client.js";
import { gameApi } from "./api.js";

export function UndoButton({ logId, onUndone }: { logId: number; onUndone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [undone, setUndone] = useState(false);
  const [forgiven, setForgiven] = useState(0);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  async function undo() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      try {
        const r = await gameApi.deleteLog(logId);
        setForgiven(r?.goldForgiven ?? 0);
      } catch (error) {
        // Already removed, e.g. from the chronicle or another tab: the goal is reached.
        if (!(error instanceof ApiError && error.code === "not_found")) throw error;
      }
      setUndone(true);
      onUndone?.();
    } catch {
      setFailed(true);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  if (undone) {
    return forgiven > 0 ? (
      <p>Eintrag entfernt. Du hattest das Gold schon ausgegeben – es bleibt bei dir, dein Gold steht jetzt auf 0.</p>
    ) : (
      <p>Eintrag entfernt.</p>
    );
  }
  return (
    <>
      <button type="button" className="game-button" disabled={busy} onClick={() => void undo()}>
        Rückgängig
      </button>
      {failed ? (
        <p role="alert" className="game-error">
          Das konnte nicht rückgängig gemacht werden.
        </p>
      ) : null}
    </>
  );
}
