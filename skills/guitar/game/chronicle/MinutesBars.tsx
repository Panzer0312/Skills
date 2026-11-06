import { INK_MUTED, SERIES, SURFACE, GRID } from "./colors.js";

const W = 560;
const H = 180;
const PAD = { l: 40, r: 8, t: 12, b: 24 };
const short = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.`;

export function MinutesBars({ weeks }: { weeks: { weekStart: string; minutes: number }[] }) {
  const top = Math.max(10, ...weeks.map((w) => w.minutes));
  const slot = (W - PAD.l - PAD.r) / weeks.length;
  const base = H - PAD.b;
  const total = weeks.reduce((s, w) => s + w.minutes, 0);
  return (
    <div style={{ background: SURFACE }}>
      <svg role="img" aria-label={`Minuten pro Woche, ${total} Minuten in ${weeks.length} Wochen`} viewBox={`0 0 ${W} ${H}`} width="100%">
        <line x1={PAD.l} x2={W - PAD.r} y1={base} y2={base} stroke={GRID} />
        <text x={PAD.l - 6} y={PAD.t + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
          {top}
        </text>
        <text x={PAD.l - 6} y={base + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
          0
        </text>
        {weeks.map((w, i) => {
          const h = (w.minutes / top) * (base - PAD.t);
          return (
            <g key={w.weekStart}>
              <title>{`Woche ab ${short(w.weekStart)}: ${w.minutes} Min.`}</title>
              {h > 0 ? <rect x={PAD.l + i * slot + 2} y={base - h} width={slot - 4} height={h} rx={3} fill={SERIES[0]} /> : null}
              {i % 3 === 0 || i === weeks.length - 1 ? (
                <text x={PAD.l + i * slot + slot / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={INK_MUTED}>
                  {short(w.weekStart)}
                </text>
              ) : null}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
