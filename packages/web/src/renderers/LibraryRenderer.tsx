export function LibraryRenderer({ title, data }: { title: string; data: unknown[] }) {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-400">{data.length} Einträge.</p>
      <ul className="space-y-2">
        {data.map((entry, i) => (
          <li key={i} className="rounded border border-slate-200 p-3 text-sm dark:border-slate-800">
            {typeof entry === "object" && entry !== null && "title" in entry
              ? String((entry as { title: unknown }).title)
              : JSON.stringify(entry)}
          </li>
        ))}
      </ul>
    </div>
  );
}
