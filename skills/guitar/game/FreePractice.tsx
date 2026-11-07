import { useEffect, useRef, useState } from "react";
import { useWakeLock } from "../../../packages/web/src/app/useWakeLock.js";
import { gameApi } from "./api.js";
import { setFreeTimerRunning } from "./freeTimerStore.js";
import { UndoButton } from "./UndoButton.js";

const KINDS = [
  { id: "song", label: "Song" },
  { id: "frei-technik", label: "Technik" },
  { id: "jam", label: "Jammen (ohne Jam Room)" },
  { id: "frei", label: "Sonstiges" },
] as const;

const MAX_SECONDS = 14400;

interface TimerRecord {
  startedAt: number;
  techniqueId: string;
}

function isTimer(raw: unknown): raw is TimerRecord | null {
  if (raw === null) return true;
  if (typeof raw !== "object") return false;
  const r = raw as Record<string, unknown>;
  return (
    typeof r.startedAt === "number" &&
    Number.isFinite(r.startedAt) &&
    typeof r.techniqueId === "string" &&
    KINDS.some((k) => k.id === r.techniqueId)
  );
}

const STORAGE_KEY = "guitar.freeTimer";

function readTimer(): TimerRecord | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const parsed: unknown = JSON.parse(raw);
    return isTimer(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeTimer(next: TimerRecord | null): void {
  try {
    if (next === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: keep in-memory value */
  }
}

function clock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

export function FreePractice() {
  const [timer, setTimerState] = useState<TimerRecord | null>(readTimer);
  const setTimer = (next: TimerRecord | null) => {
    setTimerState(next);
    writeTimer(next);
  };
  const minutesRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<string>("song");
  const [minutes, setMinutes] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const [note, setNote] = useState<string | null>(null);
  const [saved, setSaved] = useState<{ xp: number; gold: number; logId: number; undone?: boolean } | null>(null);
  const [failed, setFailed] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  const running = timer !== null;
  useWakeLock(running);

  useEffect(() => {
    setFreeTimerRunning(running);
  }, [running]);

  useEffect(() => {
    if (!running) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [running]);

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === null || e.key === STORAGE_KEY) setTimerState(readTimer());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  async function save(seconds: number, techniqueId: string): Promise<boolean> {
    if (busyRef.current) return false;
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    setNote(null);
    try {
      const r = await gameApi.log({ kind: "frei", seconds, level: 1, techniqueId });
      setSaved({ xp: r.xpGained, gold: r.goldGained, logId: r.logId });
      return true;
    } catch {
      setFailed(true);
      return false;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  }

  function discard() {
    setTimer(null);
    setNote(null);
  }

  function start() {
    setSaved(null);
    setNote(null);
    setFailed(false);
    setTimer({ startedAt: Date.now(), techniqueId: kind });
  }

  async function stop() {
    if (!timer) return;
    const stored = readTimer();
    if (!stored || stored.startedAt !== timer.startedAt) {
      setTimerState(stored);
      setSaved(null);
      setNote("Der Timer wurde schon woanders beendet.");
      return;
    }
    const seconds = Math.floor((Date.now() - timer.startedAt) / 1000);
    if (seconds > MAX_SECONDS) {
      setTimer(null);
      setSaved(null);
      setNote("Der Timer lief über 4 Stunden. Trag deine Minuten bitte selbst ein.");
      minutesRef.current?.focus();
      return;
    }
    if (seconds < 60) {
      setTimer(null);
      setSaved(null);
      setNote("Unter einer Minute, nichts gespeichert.");
      return;
    }
    if (busyRef.current) return;
    // Jam Room, quests and trainers log their own time; count only what they did not.
    busyRef.current = true;
    setBusy(true);
    setFailed(false);
    setNote(null);
    let counted = 0;
    try {
      const { entries } = await gameApi.recentLog();
      counted = entries.filter((e) => e.at >= timer.startedAt).reduce((sum, e) => sum + e.seconds, 0);
    } catch {
      setSaved(null);
      setFailed(true);
      return;
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
    const remaining = seconds - counted;
    if (remaining < 60) {
      setTimer(null);
      setSaved(null);
      setNote("Die Zeit wurde schon von anderen Übungen gezählt.");
      return;
    }
    // keep the record until the entry is saved, so a failed request loses nothing
    if (await save(remaining, timer.techniqueId)) {
      setTimer(null);
      if (counted > 0) setNote(`Davon schon gezählt: ${Math.max(1, Math.round(counted / 60))} min.`);
    }
  }

  async function submitManual() {
    const m = Number(minutes);
    if (minutes.trim() === "" || !Number.isInteger(m) || m < 1 || m > 240) {
      setSaved(null);
      setNote("Bitte 1 bis 240 Minuten eintragen.");
      return;
    }
    if (await save(m * 60, kind)) setMinutes("");
  }

  return (
    <span className="free-practice">
      <button
        type="button"
        className="game-button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        Frei üben{timer ? ` ${clock(now - timer.startedAt)}` : ""}
      </button>
      {open ? (
        <section role="dialog" aria-label="Frei üben" className="free-practice-panel">
          <label>
            Was
            <select value={timer ? timer.techniqueId : kind} disabled={running} onChange={(e) => setKind(e.target.value)}>
              {KINDS.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
          {running ? (
            <>
              <button type="button" className="game-button" disabled={busy} onClick={() => void stop()}>
                Timer stoppen und speichern
              </button>
              <button type="button" className="game-button" disabled={busy} onClick={discard}>
                Verwerfen
              </button>
            </>
          ) : (
            <button type="button" className="game-button" onClick={start}>
              Timer starten
            </button>
          )}
          <div className="free-practice-manual">
            <label>
              Minuten
              <input
                ref={minutesRef}
                type="number"
                inputMode="numeric"
                min={1}
                max={240}
                value={minutes}
                onChange={(e) => setMinutes(e.target.value)}
              />
            </label>
            <button type="button" className="game-button" disabled={busy} onClick={() => void submitManual()}>
              Eintragen
            </button>
          </div>
          {note ? <p>{note}</p> : null}
          {failed ? (
            <p role="alert" className="game-error">
              Das konnte nicht gespeichert werden.
            </p>
          ) : null}
          {saved ? (
            <div className="free-practice-saved">
              {saved.undone ? null : (
                <p>
                  +{saved.xp} XP · +{saved.gold} Gold
                </p>
              )}
              <UndoButton
                key={saved.logId}
                logId={saved.logId}
                onUndone={() => setSaved((s) => (s ? { ...s, undone: true } : s))}
              />
            </div>
          ) : null}
        </section>
      ) : null}
    </span>
  );
}
