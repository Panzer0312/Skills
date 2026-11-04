function parseDay(day: string): Date {
  const [y, m, d] = day.split("-").map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

function formatDay(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const dayOfMonth = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${month}-${dayOfMonth}`;
}

export function localDayKey(ts: number): string {
  return formatDay(new Date(ts));
}

export function previousDay(day: string): string {
  const d = parseDay(day);
  d.setDate(d.getDate() - 1);
  return formatDay(d);
}

/** The Monday of the calendar week containing `day`. */
export function weekStartKey(day: string): string {
  const d = parseDay(day);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return formatDay(d);
}
