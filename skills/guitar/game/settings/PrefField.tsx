import { PREFS, type PrefKey } from "@skills/core";
import { useEffect, useId, useState } from "react";
import { usePref } from "../usePref.js";

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function NumberInput({ prefKey, id }: { prefKey: PrefKey; id: string }) {
  const def = PREFS[prefKey];
  const [value, setValue] = usePref(prefKey);
  const [draft, setDraft] = useState(String(value));
  useEffect(() => setDraft(String(value)), [value]);
  if (def.ui.kind !== "number") return null;
  const { min, max, step, unit } = def.ui;
  const commit = () => {
    const parsed = Number(draft);
    const next = Number.isFinite(parsed) && draft.trim() !== "" ? clamp(Math.round(parsed / (step ?? 1)) * (step ?? 1), min, max) : (value as number);
    setDraft(String(next));
    if (next !== value) (setValue as (v: number) => void)(next);
  };
  return (
    <span className="studier-number">
      <input
        id={id}
        type="number"
        min={min}
        max={max}
        step={step ?? 1}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
      />
      {unit ? <span> {unit}</span> : null}
    </span>
  );
}

/** One pref, rendered by its ui kind, with its help text and a reset button. */
export function PrefField({ prefKey }: { prefKey: PrefKey }) {
  const def = PREFS[prefKey];
  const id = useId();
  const [value, setValue] = usePref(prefKey);
  if (def.ui.kind === "hidden") return null;
  const set = setValue as (v: unknown) => void;
  const helpId = `${id}-help`;
  return (
    <div className="studier-field">
      <div className="studier-row">
        {def.ui.kind === "toggle" ? (
          <label>
            <input
              type="checkbox"
              checked={Boolean(value)}
              aria-describedby={def.help ? helpId : undefined}
              onChange={(e) => set(e.target.checked)}
            />{" "}
            {def.label}
          </label>
        ) : (
          <label htmlFor={id}>{def.label}</label>
        )}
        {def.ui.kind === "select" ? (
          <select id={id} value={String(value)} aria-describedby={def.help ? helpId : undefined} onChange={(e) => set(e.target.value)}>
            {def.ui.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ) : null}
        {def.ui.kind === "number" ? <NumberInput prefKey={prefKey} id={id} /> : null}
        <button type="button" className="studier-reset" onClick={() => set(def.default)}>
          Zurücksetzen
        </button>
      </div>
      {def.help ? (
        <p id={helpId} className="studier-help">
          {def.help}
        </p>
      ) : null}
    </div>
  );
}
