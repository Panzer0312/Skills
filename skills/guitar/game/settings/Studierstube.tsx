import { PREFS, type PrefGroup, type PrefKey } from "@skills/core";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { DeviceCheck } from "../devices/DeviceCheck.js";
import { GAME_BASE, gameApi, PREFS_KEY } from "../api.js";
import { ToolFrame } from "../Places.js";
import { usePref } from "../usePref.js";
import { PrefField } from "./PrefField.js";
import "./studierstube.css";

const GROUPS: { group: PrefGroup; label: string }[] = [
  { group: "allgemein", label: "Allgemein" },
  { group: "klang", label: "Klang" },
  { group: "ueben", label: "Üben" },
  { group: "werkzeuge", label: "Werkzeuge" },
  { group: "geraete", label: "Geräte" },
  { group: "darstellung", label: "Darstellung" },
  { group: "mentor", label: "Mentor" },
  { group: "daten", label: "Daten" },
];

function visibleKeys(group: PrefGroup): PrefKey[] {
  return (Object.keys(PREFS) as PrefKey[]).filter((k) => PREFS[k].group === group && PREFS[k].ui.kind !== "hidden");
}

function DataTab() {
  const client = useQueryClient();
  const navigate = useNavigate();
  const [, setIntroSeen] = usePref("intro.gesehen");
  const [busy, setBusy] = useState(false);
  const resetAll = async () => {
    if (!window.confirm("Wirklich alle Einstellungen auf die Standardwerte zurücksetzen?")) return;
    setBusy(true);
    try {
      await gameApi.resetPrefs();
    } finally {
      setBusy(false);
      void client.invalidateQueries({ queryKey: PREFS_KEY });
    }
  };
  return (
    <div className="studier-data">
      {visibleKeys("daten").map((k) => (
        <PrefField key={k} prefKey={k} />
      ))}
      <p>
        <a href={gameApi.exportUrl} className="studier-button" download>
          Daten exportieren
        </a>
      </p>
      <p>
        <button type="button" className="studier-button" disabled={busy} onClick={() => void resetAll()}>
          Alle Einstellungen zurücksetzen
        </button>
      </p>
      <p>
        <button
          type="button"
          className="studier-button"
          onClick={() => {
            setIntroSeen(false);
            navigate(GAME_BASE);
          }}
        >
          Intro erneut ansehen
        </button>
      </p>
    </div>
  );
}

export function Studierstube() {
  const tabs = GROUPS.filter((g) => g.group === "daten" || visibleKeys(g.group).length > 0);
  const [active, setActive] = useState<PrefGroup>(tabs[0]?.group ?? "daten");
  const current = tabs.some((t) => t.group === active) ? active : "daten";
  return (
    <ToolFrame title="Studierstube">
      <div className="studier" >
        <div role="tablist" aria-label="Einstellungen" className="studier-tabs">
          {tabs.map((t) => (
            <button
              key={t.group}
              type="button"
              role="tab"
              id={`studier-tab-${t.group}`}
              aria-selected={current === t.group}
              aria-controls="studier-panel"
              onClick={() => setActive(t.group)}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div role="tabpanel" id="studier-panel" aria-labelledby={`studier-tab-${current}`} className="studier-panel">
          {current === "daten" ? (
            <DataTab />
          ) : (
            <>
              {visibleKeys(current).map((k) => (
                <PrefField key={k} prefKey={k} />
              ))}
              {current === "geraete" ? <DeviceCheck /> : null}
            </>
          )}
        </div>
      </div>
    </ToolFrame>
  );
}
