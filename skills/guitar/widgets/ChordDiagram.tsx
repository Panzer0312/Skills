import { OPEN_CHORDS } from "@skills/core";
import { ChordDiagramSingle } from "../../../packages/web/src/music/ChordDiagramSingle.js";
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

export default function ChordDiagram(_: WidgetProps) {
  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold">Akkordgriffe</h1>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Von links nach rechts: tiefe E-Saite bis hohe E-Saite. x heißt nicht anschlagen, 0 heißt leer
        spielen. Die Zahl im Punkt ist der Finger: 1 Zeigefinger, 4 kleiner Finger.
      </p>
      <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
        {Object.keys(OPEN_CHORDS).map((name) => (
          <ChordDiagramSingle key={name} name={name} />
        ))}
      </div>
    </div>
  );
}
