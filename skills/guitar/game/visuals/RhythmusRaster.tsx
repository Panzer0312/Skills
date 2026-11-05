const SYMBOLE: Record<string, { zeichen: string; name: string }> = {
  D: { zeichen: "↓", name: "Abschlag" },
  U: { zeichen: "↑", name: "Aufschlag" },
  x: { zeichen: "x", name: "gedämpft" },
  "-": { zeichen: "·", name: "Pause" },
};

const STANDARD_ZAEHLZEITEN = ["1", "+", "2", "+", "3", "+", "4", "+"];

/** One cell per pattern character: D down, U up, x muted, - rest. */
export function RhythmusRaster({ muster, zaehlzeiten }: { muster: string; zaehlzeiten?: string[] }) {
  const zeichen = [...muster];
  if (zeichen.length === 0 || zeichen.some((c) => !(c in SYMBOLE))) {
    return (
      <p role="alert" className="my-4 text-sm text-red-700 dark:text-red-300">
        Ungültiges Muster: erlaubt sind D, U, x und -.
      </p>
    );
  }
  const zaehlen = zaehlzeiten ?? STANDARD_ZAEHLZEITEN;
  const beschreibung = zeichen.map((c) => SYMBOLE[c]!.name).join(", ");
  return (
    <div
      role="img"
      aria-label={`Schlagmuster mit ${zeichen.length} Zählzeiten: ${beschreibung}`}
      className="my-4 flex flex-wrap gap-1"
    >
      {zeichen.map((c, i) => {
        const symbol = SYMBOLE[c]!;
        const aktiv = c === "D" || c === "U" || c === "x";
        return (
          <div key={i} className="flex w-10 flex-col items-center gap-1 text-center">
            <span className="text-xs text-slate-600 dark:text-slate-400">
              {zaehlen[i % zaehlen.length]}
            </span>
            <span
              data-testid="rhythmus-zelle"
              className={`flex h-10 w-10 items-center justify-center rounded border text-lg font-semibold ${
                aktiv
                  ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
                  : "border-slate-300 text-slate-500 dark:border-slate-700 dark:text-slate-400"
              }`}
            >
              {symbol.zeichen}
            </span>
          </div>
        );
      })}
    </div>
  );
}
