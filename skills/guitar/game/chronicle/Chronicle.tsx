import { metricGroup, metricSeries, weeklyMinutes, type GameState, type History } from "@skills/core";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { GAME_BASE, gameContent, useGameHistory, useGameState } from "../api.js";
import { ToolFrame } from "../Places.js";
import { formatTime } from "../StatusBar.js";
import { LineChart, type LineSeries } from "./LineChart.js";
import { MinutesBars } from "./MinutesBars.js";

const MAX_LINES = 4;

const pairLabel = (key: string) => key.slice("wechsel:".length).replace("-", "–");

function recordLabel(key: string): string {
  if (key.startsWith("wechsel:")) return `Wechsel ${pairLabel(key)}`;
  return gameContent.quests.find((quest) => quest.id === key)?.title ?? key;
}

function chartName(prefix: string, series: LineSeries[]): string {
  const parts = series.map((s) => `${s.label}, zuletzt ${s.points[s.points.length - 1]!.value}`);
  return `${prefix} ${parts.join("; ")}`;
}

function lastDay(metrics: History["metrics"], key: string): string {
  return metricSeries(metrics, key).at(-1)?.day ?? "";
}

function ChangeSection({ metrics, keys }: { metrics: History["metrics"]; keys: string[] }) {
  const latest = useMemo(
    () => [...keys].sort((a, b) => (lastDay(metrics, a) < lastDay(metrics, b) ? 1 : -1))[0]!,
    [keys, metrics],
  );
  const [picked, setPicked] = useState<string[]>([]);
  const chosen = picked.length > 0 ? picked.filter((k) => keys.includes(k)) : [latest];
  const series = chosen.map((key) => ({ label: pairLabel(key), points: metricSeries(metrics, key) }));
  const rest = keys.filter((k) => !chosen.includes(k));
  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">Wechsel pro Minute</h2>
      <div className="my-2 flex flex-wrap items-center gap-2">
        {chosen.length < MAX_LINES && rest.length > 0 ? (
          <label className="flex items-center gap-2">
            Wechsel
            <select
              value=""
              onChange={(e) => e.target.value && setPicked([...chosen, e.target.value])}
              className="rounded border px-2 py-1 text-slate-900"
            >
              <option value="">Paar hinzufügen</option>
              {rest.map((k) => (
                <option key={k} value={k}>
                  {pairLabel(k)}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {chosen.length > 1
          ? chosen.map((k) => (
              <button
                key={k}
                type="button"
                className="rounded border px-2 py-1 text-sm"
                onClick={() => setPicked(chosen.filter((c) => c !== k))}
              >
                {pairLabel(k)} entfernen
              </button>
            ))
          : null}
      </div>
      <LineChart name={chartName("Wechsel", series)} series={series} />
    </section>
  );
}

function GroupSection({
  title,
  prefix,
  metrics,
  keys,
}: {
  title: string;
  prefix: string;
  metrics: History["metrics"];
  keys: string[];
}) {
  const series = keys.map((key) => ({ label: recordLabel(key), points: metricSeries(metrics, key) }));
  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">{title}</h2>
      <LineChart name={chartName(prefix, series)} series={series} />
    </section>
  );
}

function Graphs({ history }: { history: History }) {
  const keys = [...new Set(history.metrics.map((m) => m.key))];
  const inGroup = (g: string) => keys.filter((k) => metricGroup(k, gameContent.quests) === g);
  const wechsel = inGroup("wechsel");
  const bpm = inGroup("bpm");
  const noten = inGroup("noten");
  const weeks = weeklyMinutes(history.days, new Date().toLocaleDateString("sv-SE"));
  return (
    <>
      {wechsel.length > 0 ? <ChangeSection metrics={history.metrics} keys={wechsel} /> : null}
      {bpm.length > 0 ? (
        <GroupSection title="Sauberes Tempo" prefix="Tempo:" metrics={history.metrics} keys={bpm} />
      ) : null}
      {noten.length > 0 ? (
        <GroupSection title="Noten finden" prefix="Noten finden:" metrics={history.metrics} keys={noten} />
      ) : null}
      {wechsel.length + bpm.length + noten.length === 0 ? (
        <p className="mt-6 text-slate-600 dark:text-slate-400">Noch keine Messwerte</p>
      ) : null}
      <h2 className="mt-6 text-lg font-semibold">Minuten pro Woche</h2>
      <MinutesBars weeks={weeks} />
    </>
  );
}

function Totals({ state }: { state: GameState }) {
  const entries = Object.entries(state.records);
  return (
    <>
      <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-1">
        <dt>Gesamt</dt>
        <dd>{formatTime(state.totalSeconds)}</dd>
        <dt>Diese Woche</dt>
        <dd>{formatTime(state.weekSeconds)}</dd>
        <dt>Serie</dt>
        <dd>
          {state.streak} {state.streak === 1 ? "Tag" : "Tage"}
        </dd>
        <dt>Level</dt>
        <dd>
          {state.level} · {state.title}
        </dd>
      </dl>
      <h2 className="mt-6 text-lg font-semibold">Rekorde</h2>
      {entries.length === 0 ? (
        <p className="text-slate-600 dark:text-slate-400">Noch keine Rekorde.</p>
      ) : (
        <ul>
          {entries.map(([key, value]) => (
            <li key={key} className="flex justify-between gap-6">
              <span>{recordLabel(key)}</span>
              <span>{value}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export function Chronicle() {
  const { data: state } = useGameState();
  const history = useGameHistory();
  return (
    <ToolFrame title="Chronik">
      {history.isError ? (
        <div role="alert">
          <p>Der Verlauf konnte nicht geladen werden.</p>
          <button type="button" className="underline" onClick={() => void history.refetch()}>
            Erneut versuchen
          </button>
        </div>
      ) : history.data ? (
        <Graphs history={history.data} />
      ) : (
        <p role="status">Verlauf wird geladen …</p>
      )}
      {state ? <Totals state={state} /> : null}
      <Link to={`${GAME_BASE}/einstufung`} className="mt-6 inline-block underline">
        Einstufung wiederholen
      </Link>
    </ToolFrame>
  );
}
