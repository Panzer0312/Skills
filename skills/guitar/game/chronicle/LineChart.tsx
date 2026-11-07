import { useState } from "react";
import { GRID, INK, INK_MUTED, SERIES, SURFACE } from "./colors.js";

export interface LineSeries {
  label: string;
  points: { day: string; value: number }[];
}

const W = 560;
const H = 220;
const PAD = { l: 40, r: 16, t: 12, b: 28 };
const DAY_MS = 86_400_000;

const dayNumber = (day: string) => {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return Date.UTC(y, m - 1, d) / DAY_MS;
};
const short = (day: string) => `${day.slice(8, 10)}.${day.slice(5, 7)}.${day.slice(2, 4)}`;

/** Nice upper bound for the value axis. */
function niceMax(max: number): number {
  const step = 10 ** Math.floor(Math.log10(max || 1));
  return Math.ceil(max / step) * step || 1;
}

/** One line per series on a time axis scaled by real days, so gaps stay honest. */
export function LineChart({ name, series }: { name: string; series: LineSeries[] }) {
  const [hover, setHover] = useState<{ x: number; y: number; text: string } | null>(null);
  const all = series.flatMap((s) => s.points);
  const days = all.map((p) => dayNumber(p.day));
  const first = Math.min(...days);
  const last = Math.max(...days);
  const top = niceMax(Math.max(...all.map((p) => p.value)));
  const x = (day: string) =>
    last === first ? (PAD.l + W - PAD.r) / 2 : PAD.l + ((dayNumber(day) - first) / (last - first)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + (1 - v / top) * (H - PAD.t - PAD.b);
  const firstDay = all.find((p) => dayNumber(p.day) === first)!.day;
  const lastDay = all.find((p) => dayNumber(p.day) === last)!.day;

  const show = (label: string, p: { day: string; value: number }) => () =>
    setHover({ x: x(p.day), y: y(p.value), text: `${label}: ${p.value} am ${short(p.day)}` });

  return (
    <div className="chronicle-chart" style={{ background: SURFACE, color: INK, position: "relative" }}>
      {series.length > 1 ? (
        <ul className="flex flex-wrap gap-x-4 text-sm" style={{ color: INK_MUTED }}>
          {series.map((s, i) => (
            <li key={s.label} className="flex items-center gap-1">
              <span aria-hidden style={{ background: SERIES[i % SERIES.length], width: 12, height: 3, display: "inline-block" }} />
              {s.label}
            </li>
          ))}
        </ul>
      ) : null}
      <svg role="img" aria-label={name} viewBox={`0 0 ${W} ${H}`} width="100%" onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => (
          <g key={f}>
            <line x1={PAD.l} x2={W - PAD.r} y1={y(top * f)} y2={y(top * f)} stroke={GRID} strokeWidth={1} />
            <text x={PAD.l - 6} y={y(top * f) + 4} textAnchor="end" fontSize={11} fill={INK_MUTED}>
              {top * f}
            </text>
          </g>
        ))}
        <text x={PAD.l} y={H - 8} fontSize={11} fill={INK_MUTED}>
          {short(firstDay)}
        </text>
        {last !== first ? (
          <text x={W - PAD.r} y={H - 8} fontSize={11} fill={INK_MUTED} textAnchor="end">
            {short(lastDay)}
          </text>
        ) : null}
        {series.map((s, i) => {
          const color = SERIES[i % SERIES.length]!;
          const pts = [...s.points].sort((a, b) => (a.day < b.day ? -1 : 1));
          return (
            <g key={s.label} data-testid="series">
              {pts.length > 1 ? (
                <polyline
                  fill="none"
                  stroke={color}
                  strokeWidth={2}
                  strokeLinejoin="round"
                  strokeLinecap="round"
                  points={pts.map((p) => `${x(p.day)},${y(p.value)}`).join(" ")}
                />
              ) : null}
              {pts.map((p) => (
                <circle
                  key={p.day}
                  cx={x(p.day)}
                  cy={y(p.value)}
                  r={4}
                  fill={color}
                  stroke={SURFACE}
                  strokeWidth={2}
                  tabIndex={0}
                  onMouseEnter={show(s.label, p)}
                  onFocus={show(s.label, p)}
                  onPointerDown={show(s.label, p)}
                  onBlur={() => setHover(null)}
                />
              ))}
            </g>
          );
        })}
      </svg>
      {hover ? (
        <div
          role="status"
          className="text-xs"
          style={{
            position: "absolute",
            left: `${(hover.x / W) * 100}%`,
            top: `${(hover.y / H) * 100}%`,
            transform: "translate(-50%, -140%)",
            background: INK,
            color: SURFACE,
            padding: "2px 6px",
            borderRadius: 4,
            pointerEvents: "none",
            whiteSpace: "nowrap",
          }}
        >
          {hover.text}
        </div>
      ) : null}
    </div>
  );
}
