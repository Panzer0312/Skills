import { z } from "zod";
import { definePrefs } from "./define.js";

export const prefs = definePrefs({
  "geraete.gitarreAmMikro": {
    schema: z.enum(["ja", "nein", "spaeter"]),
    default: "spaeter",
    label: "Gitarre über Mikrofon oder Interface",
    group: "geraete",
    ui: {
      kind: "select",
      options: [
        { value: "ja", label: "Ja" },
        { value: "nein", label: "Nein, ohne Gerät üben" },
        { value: "spaeter", label: "Später fragen" },
      ],
    },
  },
  "geraete.eingang": {
    schema: z.string().nullable(),
    default: null,
    label: "Eingabegerät",
    group: "geraete",
    ui: { kind: "hidden" },
  },
});
