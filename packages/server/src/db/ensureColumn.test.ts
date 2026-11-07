import { describe, expect, it } from "vitest";
import { openDatabase } from "./client.js";
import { ensureColumn } from "./ensureColumn.js";

describe("ensureColumn", () => {
  it("ensureColumn adds a missing column once", () => {
    const { raw, close } = openDatabase(":memory:");
    raw.exec("CREATE TABLE t_demo (id INTEGER PRIMARY KEY)");
    const cols = () => (raw.pragma("table_info(t_demo)") as { name: string }[]).map((c) => c.name);
    ensureColumn(raw, "t_demo", "extra", "extra TEXT NOT NULL DEFAULT 'x'");
    expect(cols()).toEqual(["id", "extra"]);
    expect(() => ensureColumn(raw, "t_demo", "extra", "extra TEXT NOT NULL DEFAULT 'x'")).not.toThrow();
    expect(cols()).toEqual(["id", "extra"]);
    close();
  });
});
