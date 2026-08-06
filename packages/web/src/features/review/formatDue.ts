const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const MONTH = 30 * DAY;

export function formatDue(due: number, now: number): string {
  const delta = due - now;
  if (delta <= MINUTE / 2) return "jetzt";
  if (delta < HOUR) return `in ${Math.round(delta / MINUTE)} Min.`;
  if (delta < DAY) return `in ${Math.round(delta / HOUR)} Std.`;
  if (delta < MONTH) {
    const days = Math.round(delta / DAY);
    return days === 1 ? "in 1 Tag" : `in ${days} Tagen`;
  }
  const months = Math.round(delta / MONTH);
  return months === 1 ? "in 1 Monat" : `in ${months} Monaten`;
}
