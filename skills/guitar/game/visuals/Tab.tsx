const LABELS = ["e", "H", "G", "D", "A", "E"];

/** Six-line tab, high e on top. Each line holds only the fret characters, labels are added here. */
export function Tab({ titel, zeilen }: { titel?: string; zeilen: string[] }) {
  if (zeilen.length !== 6) {
    return (
      <p role="alert" className="my-4 text-sm text-red-700 dark:text-red-300">
        Ungültige Tabulatur: sechs Zeilen nötig.
      </p>
    );
  }
  return (
    <figure
      className="my-4"
      aria-label={`Tabulatur${titel ? ` ${titel}` : ""}: sechs Saiten, hohe e-Saite oben`}
    >
      {titel ? <figcaption className="mb-1 text-sm font-semibold">{titel}</figcaption> : null}
      <pre className="overflow-x-auto rounded border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-tight text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        {zeilen.map((zeile, i) => (
          <div key={i} data-testid="tab-zeile">
            {`${LABELS[i]}|${zeile}|`}
          </div>
        ))}
      </pre>
    </figure>
  );
}
