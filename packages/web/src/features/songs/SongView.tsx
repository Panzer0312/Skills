import { transposeSong, type Song } from "@skills/core";
import { useEffect, useRef, useState } from "react";
import { ApiError } from "../../api/client.js";
import { useMetronome } from "../../audio/useMetronome.js";
import { ChordDiagramSingle } from "../../music/ChordDiagramSingle.js";
import { ChordEditor } from "../../music/ChordEditor.js";
import { useChordOverrides } from "../../music/useChordOverrides.js";
import { resolveChordShape } from "../../music/userChords.js";
import { nextScrollTop, type ScrollRange } from "./autoScroll.js";

const CHORD_SAVE_FALLBACK_ERROR = "Der Griff konnte nicht gespeichert werden. Bitte später erneut versuchen.";

/** Offset of an element from the top of the scrollable content, measured at call time. */
function contentOffset(container: HTMLElement, element: HTMLElement): number {
  return element.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
}

function scrollRange(container: HTMLElement, sections: (HTMLElement | null)[], loopIndex: number | null): ScrollRange {
  const viewport = container.clientHeight;
  if (loopIndex === null) return { start: 0, end: container.scrollHeight, viewport, loop: false };
  const current = sections[loopIndex];
  const following = sections[loopIndex + 1];
  return {
    start: current ? contentOffset(container, current) : 0,
    end: following ? contentOffset(container, following) : container.scrollHeight,
    viewport,
    loop: true,
  };
}

function LineWithChords({ line }: { line: Song["sections"][number]["lines"][number] }) {
  if (line.chords.length === 0) {
    return <div className="whitespace-pre font-mono text-sm">{line.lyrics}</div>;
  }

  let chordRow = "";
  for (const chord of line.chords) {
    if (chord.position > chordRow.length) chordRow = chordRow.padEnd(chord.position, " ");
    chordRow += chord.symbol;
  }

  return (
    <div className="font-mono text-sm">
      <div className="whitespace-pre font-medium text-amber-700 dark:text-amber-400">{chordRow}</div>
      <div className="whitespace-pre">{line.lyrics}</div>
    </div>
  );
}

export function SongView({ song, songKey }: { song: Song; songKey?: string }) {
  const [steps, setSteps] = useState(0);
  const [scrolling, setScrolling] = useState(false);
  const [scrollSpeed, setScrollSpeed] = useState(30);
  const [editing, setEditing] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [loopIndex, setLoopIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const sectionRefs = useRef<(HTMLElement | null)[]>([]);
  const metronome = useMetronome();
  const { overrides, entries, save, reset } = useChordOverrides(songKey);

  const shown = steps === 0 ? song : transposeSong(song, steps);

  useEffect(() => {
    if (!scrolling) return;
    const timer = setInterval(() => {
      const container = containerRef.current;
      if (!container) return;
      const range = scrollRange(container, sectionRefs.current, loopIndex);
      const { top, done } = nextScrollTop(container.scrollTop, 1, range);
      container.scrollTop = top;
      if (done) setScrolling(false);
    }, Math.max(10, 2000 / scrollSpeed));
    return () => clearInterval(timer);
  }, [scrolling, scrollSpeed, loopIndex]);

  function chooseLoop(value: string) {
    if (value === "") {
      setLoopIndex(null);
      return;
    }
    const index = Number(value);
    setLoopIndex(index);
    const container = containerRef.current;
    const element = sectionRefs.current[index];
    if (container && element) container.scrollTop = contentOffset(container, element);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">{shown.title}</h1>
        {shown.artist ? <p className="text-slate-600 dark:text-slate-400">{shown.artist}</p> : null}
        {shown.capo > 0 ? <p className="text-sm text-slate-500">Kapodaster im {shown.capo}. Bund</p> : null}
      </div>

      <div className="flex flex-wrap items-center gap-2 text-sm">
        <button
          type="button"
          onClick={() => setSteps((s) => s - 1)}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          Halbton tiefer
        </button>
        <span className="w-16 text-center">{steps > 0 ? `+${steps}` : steps}</span>
        <button
          type="button"
          onClick={() => setSteps((s) => s + 1)}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          Halbton höher
        </button>

        <button
          type="button"
          onClick={() => setScrolling((v) => !v)}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          {scrolling ? "Auto-Scroll stoppen" : "Auto-Scroll starten"}
        </button>
        <label className="flex items-center gap-2">
          <span>Tempo</span>
          <input
            type="range"
            min={5}
            max={100}
            value={scrollSpeed}
            onChange={(e) => setScrollSpeed(Number(e.target.value))}
            aria-label="Scroll-Tempo"
          />
        </label>
        {shown.sections.length > 1 ? (
          <label className="flex items-center gap-2">
            <span>Abschnitt wiederholen</span>
            <select
              value={loopIndex === null ? "" : String(loopIndex)}
              onChange={(e) => chooseLoop(e.target.value)}
              className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
            >
              <option value="">Ganzer Song</option>
              {shown.sections.map((section, i) => (
                <option key={i} value={i}>
                  {`${i + 1}. ${section.name}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <button
          type="button"
          onClick={() => (metronome.running ? metronome.stop() : metronome.start())}
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
        >
          Metronom {metronome.running ? "aus" : "an"} ({metronome.bpm})
        </button>
      </div>

      {shown.chordsUsed.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-4 lg:grid-cols-6">
          {shown.chordsUsed.map((chord) => (
            <ChordDiagramSingle
              key={chord}
              name={chord}
              overrides={overrides}
              onEdit={() => {
                setEditError(null);
                setEditing(chord);
              }}
            />
          ))}
        </div>
      ) : null}

      {editing ? (
        <ChordEditor
          symbol={editing}
          initial={resolveChordShape(editing, overrides)}
          allowSongScope={Boolean(songKey)}
          canReset={{
            song: entries.song.some((entry) => entry.symbol === editing),
            global: entries.global.some((entry) => entry.symbol === editing),
          }}
          onSave={async (shape, scope) => {
            try {
              await save(editing, shape, scope);
              setEditError(null);
              setEditing(null);
            } catch (err) {
              setEditError(err instanceof ApiError ? err.message : CHORD_SAVE_FALLBACK_ERROR);
            }
          }}
          onReset={async (scope) => {
            try {
              await reset(editing, scope);
              setEditError(null);
              setEditing(null);
            } catch (err) {
              setEditError(err instanceof ApiError ? err.message : CHORD_SAVE_FALLBACK_ERROR);
            }
          }}
          onCancel={() => {
            setEditError(null);
            setEditing(null);
          }}
        />
      ) : null}
      {editing && editError ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {editError}
        </p>
      ) : null}

      <div ref={containerRef} className="max-h-[60vh] overflow-y-auto rounded border border-slate-200 p-4 dark:border-slate-800">
        {shown.sections.map((section, i) => (
          <section
            key={i}
            ref={(element) => {
              sectionRefs.current[i] = element;
            }}
            className="mb-6"
          >
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
              {section.name}
            </h2>
            {section.lines.map((line, j) => (
              <LineWithChords key={j} line={line} />
            ))}
            {section.tab.map((tabLine, j) => (
              <pre key={j} className="my-3 overflow-x-auto text-xs">
                {tabLine.strings.join("\n")}
              </pre>
            ))}
          </section>
        ))}
      </div>
    </div>
  );
}
