import { useRef, useState } from "react";
import { ApiError } from "../../../packages/web/src/api/client.js";
import { gameApi } from "./api.js";

export function UndoButton({ logId, onUndone }: { logId: number; onUndone?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [undone, setUndone] = useState(false);
  const [failed, setFailed] = useState(false);
  const busyRef = useRef(false);

  async function undo() {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    try {
      try {
        await gameApi.deleteLog(logId);
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

  if (undone) return <p>Eintrag entfernt.</p>;
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
