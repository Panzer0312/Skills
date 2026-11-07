import { inputLevel } from "@skills/core";
import { useCallback, useEffect, useState } from "react";
import { useInputDevices } from "../../../../packages/web/src/audio/useInputDevices.js";
import { useMicrophone } from "../../../../packages/web/src/audio/useMicrophone.js";
import { InputControls } from "../InputControls.js";
import { usePref } from "../usePref.js";

export const LEVEL_TEST_MS = 5000;

const CHOICES = [
  { value: "ja", label: "Ja" },
  { value: "nein", label: "Nein, ohne Gerät üben" },
  { value: "spaeter", label: "Später fragen" },
] as const;

export function DeviceCheck() {
  const [guitar, setGuitar] = usePref("geraete.gitarreAmMikro");
  const [, setStored] = usePref("geraete.eingang");
  const inputs = useInputDevices();
  const [level, setLevel] = useState(0);
  const [testing, setTesting] = useState(false);
  const [savedInput, setSavedInput] = useState(false);

  const onBuffer = useCallback((buffer: Float32Array) => setLevel(inputLevel(buffer)), []);
  const mic = useMicrophone({
    onBuffer,
    deviceId: inputs.deviceId,
    onDeviceLost: () => inputs.select(null),
  });
  const { start, stop } = mic;

  useEffect(() => {
    if (!testing) return;
    void start();
    const timer = setTimeout(() => setTesting(false), LEVEL_TEST_MS);
    return () => {
      clearTimeout(timer);
      stop();
      setLevel(0);
    };
  }, [testing, start, stop]);

  useEffect(() => {
    if (mic.state === "running") void inputs.refresh();
  }, [mic.state, inputs.refresh]);

  return (
    <section className="mb-6 space-y-3 rounded border border-slate-300 p-4 dark:border-slate-700">
      <h2 className="text-lg font-semibold">Geräte</h2>
      <p className="text-sm">
        Spielst du die Gitarre über Mikrofon oder Interface? Dann kann die App Töne erkennen. Alles andere geht auch ohne.
      </p>
      <fieldset className="space-y-1 text-sm">
        <legend className="sr-only">Gitarre über Mikrofon oder Interface</legend>
        {CHOICES.map((choice) => (
          <label key={choice.value} className="mr-4 inline-flex items-center gap-1">
            <input
              type="radio"
              name="gitarre-am-mikro"
              value={choice.value}
              checked={guitar === choice.value}
              onChange={() => setGuitar(choice.value)}
            />
            {choice.label}
          </label>
        ))}
      </fieldset>
      {guitar === "nein" ? (
        <p className="text-sm">Alles funktioniert auch ohne Gerät – per Klick und mit Referenztönen.</p>
      ) : null}
      {guitar === "ja" ? (
        <div className="space-y-2">
          <InputControls devices={inputs.devices} deviceId={inputs.deviceId} onSelect={inputs.select} level={level} />
          {mic.error ? <p className="text-sm">{mic.error}</p> : null}
          <div className="flex gap-2 text-sm">
            <button
              type="button"
              disabled={testing}
              onClick={() => setTesting(true)}
              className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
            >
              Pegel testen
            </button>
            <button
              type="button"
              onClick={() => {
                setStored(inputs.deviceId);
                setTesting(false);
                setSavedInput(true);
              }}
              className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
            >
              Passt
            </button>
            {savedInput ? <span role="status">Gespeichert.</span> : null}
          </div>
        </div>
      ) : null}
    </section>
  );
}
