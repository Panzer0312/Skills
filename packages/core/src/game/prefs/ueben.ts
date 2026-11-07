import { z } from "zod";
import { definePrefs } from "./define.js";

export const prefs = definePrefs({
  "freiUeben.nachfragenAbMinuten": {
    schema: z.number().int().min(15).max(240),
    default: 90,
    label: "Frei üben: ab wie vielen Minuten nachfragen",
    group: "ueben",
    ui: { kind: "number", min: 15, max: 240, unit: "min" },
  },
});
