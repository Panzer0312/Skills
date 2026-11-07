import type { Database } from "better-sqlite3";

/** Adds `column` to `table` with the given definition when it is missing; does nothing otherwise. */
export function ensureColumn(db: Database, table: string, column: string, ddl: string): void {
  const columns = db.pragma(`table_info(${table})`) as { name: string }[];
  if (columns.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
}
