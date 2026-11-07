import { useRef, useState } from "react";
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
      await gameApi.deleteLog(logId);
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
