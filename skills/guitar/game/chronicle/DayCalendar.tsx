import { useRef, useState, type KeyboardEvent } from "react";
import { dayGrid, localDayKey, type History } from "@skills/core";
import { INK, INK_MUTED, SHADES, SURFACE } from "./colors.js";

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const CELL = 16;
const LABEL_WIDTH = 24;
const STEPS: Record<string, number> = { ArrowLeft: -7, ArrowRight: 7, ArrowUp: -1, ArrowDown: 1 };

const shade = (minutes: number) => (minutes >= 30 ? 3 : minutes >= 15 ? 2 : minutes >= 1 ? 1 : 0);

const dayLabel = (day: string, minutes: number) =>
  `${Number(day.slice(8, 10))}. ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}: ${minutes} min`;

const monthOf = (day: string) => Number(day.slice(5, 7)) - 1;

const shiftDay = (day: string, n: number) =>
  localDayKey(new Date(Number(day.slice(0, 4)), monthOf(day), Number(day.slice(8, 10)) + n).getTime());

/**
 * Practice days of the last weeks as an ARIA grid: rows are weekdays, columns are weeks.
 * One cell is tabbable (roving tabindex, default today); arrow keys, Home and End move the focus.
 * No marking of missed days.
 */
export function DayCalendar({ days, today }: { days: History["days"]; today: string }) {
  const grid = dayGrid(days, today);
  const cells = grid.flat();
  const minutesOf = new Map(cells.map(({ day, minutes }) => [day, minutes]));
  const [selected, setSelected] = useState(today);
  const [focused, setFocused] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  const focusDay = (day: string) => {
    if (minutesOf.has(day)) gridRef.current?.querySelector<HTMLElement>(`[data-day="${day}"]`)?.focus();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLSpanElement>, day: string) => {
    let target: string | undefined;
    if (event.key in STEPS) target = shiftDay(day, STEPS[event.key]!);
    else if (event.key === "Home") target = cells[0]!.day;
    else if (event.key === "End") target = cells[cells.length - 1]!.day;
    if (target === undefined || !minutesOf.has(target)) return;
    event.preventDefault();
    focusDay(target);
  };

  const monthLabels = grid.map((week, i) =>
    i === 0 || monthOf(week[0]!.day) !== monthOf(grid[i - 1]![0]!.day) ? MONTHS[monthOf(week[0]!.day)] : "",
  );

  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">Übungstage</h2>
      <div
        ref={gridRef}
        role="grid"
        aria-label="Übungstage"
        className="flex flex-col gap-1 p-2"
        style={{ background: SURFACE, color: INK_MUTED }}
      >
        <div role="row" className="flex gap-1 text-xs">
          <span role="presentation" style={{ width: LABEL_WIDTH, flex: "none" }} />
          {grid.map((week, i) => (
            <div key={week[0]!.day} role="columnheader" style={{ width: CELL, flex: "none", whiteSpace: "nowrap" }}>
              {monthLabels[i]}
            </div>
          ))}
        </div>
        {WEEKDAYS.map((weekday, row) => (
          <div key={weekday} role="row" className="flex gap-1">
            <span role="rowheader" className="text-xs" style={{ width: LABEL_WIDTH, flex: "none" }}>
              {weekday}
            </span>
            {grid.map((week) => {
              const cell = week[row];
              if (!cell) return <span key={week[0]!.day} role="presentation" style={{ width: CELL, height: CELL, flex: "none" }} />;
              const { day, minutes } = cell;
              return (
                <span
                  key={day}
                  role="gridcell"
                  tabIndex={day === selected ? 0 : -1}
                  data-day={day}
                  title={dayLabel(day, minutes)}
                  aria-label={dayLabel(day, minutes)}
                  data-shade={shade(minutes)}
                  onFocus={() => {
                    setSelected(day);
                    setFocused(day);
                  }}
                  onBlur={() => setFocused(null)}
                  onKeyDown={(event) => onKeyDown(event, day)}
                  style={{ width: CELL, height: CELL, borderRadius: 3, background: SHADES[shade(minutes)], flex: "none" }}
                />
              );
            })}
          </div>
        ))}
        <div aria-hidden="true" className="h-5 text-sm" style={{ color: INK }}>
          {focused ? dayLabel(focused, minutesOf.get(focused)!) : ""}
        </div>
      </div>
    </section>
  );
}
