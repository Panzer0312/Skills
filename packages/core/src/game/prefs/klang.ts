import { z } from "zod";
import { definePrefs } from "./define.js";

export const prefs = definePrefs({
  "klang.an": {
    schema: z.boolean(),
    default: false,
    label: "Klang im Dorf",
    group: "klang",
    ui: { kind: "toggle" },
  },
});
