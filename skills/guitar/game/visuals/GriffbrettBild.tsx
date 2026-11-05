export interface GriffbrettPunkt {
  saite: number;
  bund: number;
  text?: string;
}

const SAITEN = ["e", "H", "G", "D", "A", "E"]; // saite 1 = high e
const LEFT = 28;
const TOP = 16;
const GAP_X = 52;
const GAP_Y = 22;

/** Fretboard section with marked points. saite 1 = high e, 6 = low E; bund 0 = open string. */
export function GriffbrettBild({ punkte, bis = 5 }: { punkte: GriffbrettPunkt[]; bis?: number }) {
  const breite = LEFT + GAP_X * bis + 12;
  const hoehe = TOP * 2 + GAP_Y * 5 + 14;
  const beschreibung = punkte
    .map((p) => `${SAITEN[p.saite - 1] ?? "?"}-Saite ${p.bund === 0 ? "leer" : `Bund ${p.bund}`}`)
    .join(", ");
  return (
    <svg
      viewBox={`0 0 ${breite} ${hoehe}`}
      role="img"
      aria-label={`Griffbrett bis Bund ${bis}: ${beschreibung}`}
      className="my-4 w-full max-w-xl text-slate-900 dark:text-slate-100"
    >
      {SAITEN.map((name, i) => (
        <g key={name}>
          <text x={8} y={TOP + i * GAP_Y + 4} fontSize="12" textAnchor="middle" fill="currentColor">
            {name}
          </text>
          <line
            x1={LEFT}
            x2={LEFT + GAP_X * bis}
            y1={TOP + i * GAP_Y}
            y2={TOP + i * GAP_Y}
            stroke="currentColor"
            strokeWidth={1 + i * 0.3}
          />
        </g>
      ))}
      {Array.from({ length: bis + 1 }, (_, n) => (
        <line
          key={n}
          x1={LEFT + n * GAP_X}
          x2={LEFT + n * GAP_X}
          y1={TOP}
          y2={TOP + GAP_Y * 5}
          stroke="currentColor"
          strokeWidth={n === 0 ? 4 : 1}
          opacity={n === 0 ? 1 : 0.6}
        />
      ))}
      {Array.from({ length: bis }, (_, n) => (
        <text
          key={n}
          x={LEFT + n * GAP_X + GAP_X / 2}
          y={TOP + GAP_Y * 5 + 18}
          fontSize="11"
          textAnchor="middle"
          fill="currentColor"
          opacity={0.7}
        >
          {n + 1}
        </text>
      ))}
      {punkte.map((p) => {
        const cx = p.bund === 0 ? LEFT - 2 : LEFT + (p.bund - 0.3) * GAP_X;
        const cy = TOP + (p.saite - 1) * GAP_Y;
        const offen = p.bund === 0;
        return (
          <g key={`${p.saite}-${p.bund}`} data-testid={`punkt-${p.saite}-${p.bund}`}>
            <circle
              cx={cx}
              cy={cy}
              r={9}
              fill={offen ? "none" : "currentColor"}
              stroke="currentColor"
              strokeWidth={2}
            />
            {p.text ? (
              <text
                x={cx}
                y={cy + 4}
                fontSize="11"
                textAnchor="middle"
                className={offen ? "fill-current" : "fill-white dark:fill-slate-900"}
              >
                {p.text}
              </text>
            ) : null}
          </g>
        );
      })}
    </svg>
  );
}
