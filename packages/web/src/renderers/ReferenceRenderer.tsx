export function ReferenceRenderer({ title, data }: { title: string; data: unknown[] }) {
  const rows = data.filter((row): row is Record<string, unknown> => typeof row === "object" && row !== null);
  const columns = Array.from(new Set(rows.flatMap((row) => Object.keys(row))));

  if (columns.length === 0) {
    return (
      <div>
        <h1 className="text-2xl font-semibold">{title}</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-400">Keine Einträge vorhanden.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <div className="overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800">
              {columns.map((column) => (
                <th key={column} className="px-3 py-2 font-medium">{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-slate-100 dark:border-slate-900">
                {columns.map((column) => (
                  <td key={column} className="px-3 py-2">{String(row[column] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
