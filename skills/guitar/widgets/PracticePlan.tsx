import { useEffect, useState } from "react";
import { useMetronome } from "../../../packages/web/src/audio/useMetronome.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

interface Block {
  id: string;
  titel: string;
  minuten: number;
  beschreibung: string;
  bpm?: number;
}

function format(seconds: number): string {
  const m = String(Math.floor(seconds / 60)).padStart(2, "0");
  const s = String(seconds % 60).padStart(2, "0");
  return `${m}:${s}`;
}

export default function PracticePlan({ data, progress }: WidgetProps) {
  const blocks = (data.flat() as Block[]).filter((block) => block && typeof block.id === "string");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const metronome = useMetronome();

  useEffect(() => {
    if (activeId === null) return;
    const timer = setInterval(() => setRemaining((value) => Math.max(0, value - 1)), 1000);
    return () => clearInterval(timer);
  }, [activeId]);

  const total = blocks.reduce((sum, block) => sum + block.minuten, 0);
  const active = blocks.find((block) => block.id === activeId);
  const totalText = `${total} Minuten insgesamt.`;

  function startBlock(block: Block) {
    setActiveId(block.id);
    setRemaining(block.minuten * 60);
    if (block.bpm) metronome.setBpm(block.bpm);
  }

  function finish(block: Block) {
    progress.record(block.id, "correct");
    metronome.stop();
    setActiveId(null);
    setRemaining(0);
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Übungsplan</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          {total} Minuten insgesamt. Lieber täglich kurz als einmal lang.
        </p>
      </div>

      <ul className="space-y-3">
        {blocks.map((block) => (
          <li key={block.id} className="rounded border border-slate-200 p-4 dark:border-slate-800">
            <div className="flex items-center justify-between">
              <h2 className="font-medium">{block.titel}</h2>
              <span className="text-sm text-slate-500">
                {totalText.includes(`${block.minuten} Minuten`) ? (
                  <>
                    <span>{block.minuten}</span> Minuten{block.bpm ? ` · ${block.bpm} BPM` : ""}
                  </>
                ) : (
                  <>
                    {block.minuten} Minuten{block.bpm ? ` · ${block.bpm} BPM` : ""}
                  </>
                )}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{block.beschreibung}</p>

            {activeId === block.id ? (
              <div className="mt-3 flex items-center gap-3">
                <span data-testid="timer" className="font-mono text-2xl">
                  {format(remaining)}
                </span>
                <button
                  type="button"
                  onClick={() => (metronome.running ? metronome.stop() : metronome.start())}
                  className="rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
                >
                  Metronom {metronome.running ? "aus" : "an"} ({metronome.bpm})
                </button>
                <button
                  type="button"
                  onClick={() => finish(block)}
                  className="rounded bg-slate-900 px-3 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
                >
                  Fertig
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => startBlock(block)}
                className="mt-3 rounded border border-slate-300 px-3 py-1 text-sm dark:border-slate-700"
              >
                Starten
              </button>
            )}
          </li>
        ))}
      </ul>

      {active ? <p className="text-sm text-slate-500">Läuft: {active.titel}</p> : null}
    </div>
  );
}
