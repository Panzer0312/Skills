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
  const ungleich = new Set(zeilen.map((z) => z.length)).size > 1;
  return (
    <figure
      className="my-4"
      aria-label={`Tabulatur${titel ? ` ${titel}` : ""}: sechs Saiten, hohe e-Saite oben`}
    >
      {ungleich ? (
        <p role="alert" className="mb-1 text-sm text-red-700 dark:text-red-300">
          Hinweis: Die Zeilen sind unterschiedlich lang, die Tabulatur ist verschoben.
        </p>
      ) : null}
      {titel ? <figcaption className="mb-1 text-sm font-semibold">{titel}</figcaption> : null}
      <pre className="overflow-x-auto rounded border border-slate-300 bg-slate-50 p-3 font-mono text-sm leading-tight text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
        {zeilen.map((zeile, i) => (
          <span key={i} data-testid="tab-zeile" className="block">
            {`${LABELS[i]}|${zeile}|`}
          </span>
        ))}
      </pre>
    </figure>
  );
}
