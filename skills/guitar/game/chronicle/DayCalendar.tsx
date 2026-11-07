import { dayGrid, type History } from "@skills/core";
import { INK_MUTED, SHADES, SURFACE } from "./colors.js";

const MONTHS = ["Jan.", "Feb.", "März", "Apr.", "Mai", "Juni", "Juli", "Aug.", "Sep.", "Okt.", "Nov.", "Dez."];

const shade = (minutes: number) => (minutes >= 30 ? 3 : minutes >= 15 ? 2 : minutes >= 1 ? 1 : 0);

const dayLabel = (day: string, minutes: number) =>
  `${Number(day.slice(8, 10))}. ${MONTHS[Number(day.slice(5, 7)) - 1]} ${day.slice(0, 4)}: ${minutes} min`;

/** Practice days of the last weeks as shaded squares, one column per week. No marking of missed days. */
export function DayCalendar({ days, today }: { days: History["days"]; today: string }) {
  const grid = dayGrid(days, today);
  return (
    <section>
      <h2 className="mt-6 text-lg font-semibold">Übungstage</h2>
      <div className="flex gap-1 p-2" style={{ background: SURFACE, color: INK_MUTED }}>
        {grid.map((week) => (
          <div key={week[0]!.day} className="flex flex-col gap-1">
            {week.map(({ day, minutes }) => (
              <span
                key={day}
                role="img"
                title={dayLabel(day, minutes)}
                aria-label={dayLabel(day, minutes)}
                data-shade={shade(minutes)}
                style={{ width: 16, height: 16, borderRadius: 3, background: SHADES[shade(minutes)] }}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}
