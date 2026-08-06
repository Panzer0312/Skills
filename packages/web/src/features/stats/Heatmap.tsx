const LEVELS = ["bg-slate-200 dark:bg-slate-800", "bg-emerald-200", "bg-emerald-400", "bg-emerald-600"];

function level(count: number): string {
  if (count === 0) return LEVELS[0]!;
  if (count < 10) return LEVELS[1]!;
  if (count < 30) return LEVELS[2]!;
  return LEVELS[3]!;
}

export function Heatmap({ days }: { days: { day: string; count: number }[] }) {
  return (
    <div className="flex flex-wrap gap-[3px]" role="img" aria-label="Lernaktivität der letzten 365 Tage">
      {days.map((entry) => (
        <span
          key={entry.day}
          title={`${entry.day}: ${entry.count}`}
          className={`h-3 w-3 rounded-sm ${level(entry.count)}`}
        />
      ))}
    </div>
  );
}
