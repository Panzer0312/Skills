import { z } from "zod";
import { definePrefs } from "./define.js";

export const prefs = definePrefs({
  "intro.gesehen": {
    schema: z.boolean(),
    default: false,
    label: "Intro gesehen",
    group: "allgemein",
    ui: { kind: "hidden" },
  },
});
