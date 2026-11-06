import type { Tuning } from "@skills/core";

export interface FretMark {
  label: string;
  state: "normal" | "dim" | "scale" | "root";
}

const FRET_COUNT = 15;
const MARKERS = [3, 5, 7, 9, 12, 15];

const STATE_CLASS: Record<FretMark["state"], string> = {
  normal: "",
  dim: "text-slate-300 dark:text-slate-700",
  scale: "font-medium",
  root: "rounded-full bg-amber-500 font-bold text-white",
};

export function FretboardGrid({
  tuning,
  mark,
  onFret,
}: {
  tuning: Tuning;
  mark: (stringIndex: number, fret: number) => FretMark;
  onFret?: (stringIndex: number, fret: number) => void;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="border-collapse text-center text-xs">
        <tbody>
          {tuning.strings.map((_, reversed) => {
            const stringIndex = tuning.strings.length - 1 - reversed;
            return (
              <tr key={stringIndex}>
                {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => {
                  const { label, state } = mark(stringIndex, fret);
                  const shared = {
                    "data-testid": `fret-${stringIndex}-${fret}`,
                    "data-in-scale": String(state !== "dim"),
                    "data-root": String(state === "root"),
                    className: `mx-auto flex h-8 w-9 items-center justify-center ${STATE_CLASS[state]}`,
                  };
                  return (
                    <td
                      key={fret}
                      className={`border border-slate-300 p-0 dark:border-slate-700 ${
                        fret === 0 ? "bg-slate-200 dark:bg-slate-800" : ""
                      }`}
                    >
                      {onFret ? (
                        <button type="button" {...shared} onClick={() => onFret(stringIndex, fret)}>
                          {label}
                        </button>
                      ) : (
                        <div {...shared}>{label}</div>
                      )}
                    </td>
                  );
                })}
              </tr>
            );
          })}
          <tr>
            {Array.from({ length: FRET_COUNT + 1 }, (_, fret) => (
              <td key={fret} className="pt-1 text-slate-500">
                {MARKERS.includes(fret) ? fret : fret === 0 ? "leer" : ""}
              </td>
            ))}
          </tr>
        </tbody>
      </table>
    </div>
  );
}
