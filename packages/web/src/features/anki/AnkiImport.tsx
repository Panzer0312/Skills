import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { ApiError } from "../../api/client.js";
import { getSkills } from "../../skills/registry.js";

interface FieldMapping {
  front: number;
  back: number;
  reading: number | null;
  note: number | null;
}

interface NoteType {
  id: number;
  name: string;
  fields: string[];
}

interface Preview {
  deckName: string;
  noteTypes: NoteType[];
  noteCount: number;
  cardCount: number;
  mediaCount: number;
  samples: { front: string; back: string }[];
  suggestedMapping: Record<string, FieldMapping>;
}

async function postForm<T>(path: string, data: FormData): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, { method: "POST", body: data });
  } catch {
    throw new ApiError("offline", "Der Server ist nicht erreichbar.");
  }
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { error?: { code?: string; message?: string } } | null;
    throw new ApiError(body?.error?.code ?? "unknown", body?.error?.message ?? "Import fehlgeschlagen.");
  }
  return (await response.json()) as T;
}

export function AnkiImport() {
  const skills = getSkills();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [mapping, setMapping] = useState<Record<string, FieldMapping>>({});
  const [skillId, setSkillId] = useState(skills[0]?.manifest.id ?? "");
  const [moduleTitle, setModuleTitle] = useState("");
  const [keepScheduling, setKeepScheduling] = useState(false);
  const [done, setDone] = useState<{ notes: number; cards: number; media: number } | null>(null);

  const load = useMutation({
    mutationFn: async (selected: File) => {
      const data = new FormData();
      data.set("file", selected);
      return postForm<Preview>("/api/anki/preview", data);
    },
    onSuccess: (result) => {
      setPreview(result);
      setMapping(result.suggestedMapping);
      setModuleTitle(result.deckName);
      setDone(null);
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      if (!file) throw new ApiError("no_file", "Keine Datei gewählt.");
      const data = new FormData();
      data.set("file", file);
      data.set(
        "options",
        JSON.stringify({
          skillId,
          moduleId: `anki-${moduleTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`,
          moduleTitle,
          mapping,
          keepScheduling,
        }),
      );
      return postForm<{ notes: number; cards: number; media: number }>("/api/anki/import", data);
    },
    onSuccess: setDone,
  });

  const error = load.error ?? run.error;

  function updateMapping(noteTypeId: string, key: keyof FieldMapping, value: number | null) {
    setMapping((current) => ({ ...current, [noteTypeId]: { ...current[noteTypeId]!, [key]: value } }));
  }

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="text-2xl font-semibold">Anki-Deck importieren</h1>

      <label className="block space-y-2">
        <span className="text-sm">Datei (.apkg)</span>
        <input
          type="file"
          accept=".apkg"
          onChange={(e) => {
            const selected = e.target.files?.[0] ?? null;
            setFile(selected);
            if (selected) load.mutate(selected);
          }}
          className="block w-full text-sm"
        />
      </label>

      {error ? (
        <p className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
          {error instanceof ApiError ? error.message : "Unbekannter Fehler."}
        </p>
      ) : null}

      {load.isPending ? <p>Deck wird gelesen…</p> : null}

      {preview ? (
        <>
          <section className="rounded border border-slate-200 p-4 dark:border-slate-800">
            <h2 className="font-medium">{preview.deckName}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {preview.noteCount} Notizen, {preview.cardCount} Karten, {preview.mediaCount} Mediendateien.
            </p>
            <ul className="mt-3 space-y-1 text-sm">
              {preview.samples.map((sample, i) => (
                <li key={i}>
                  <span>{sample.front}</span> → <span>{sample.back}</span>
                </li>
              ))}
            </ul>
          </section>

          {preview.noteTypes.map((noteType) => {
            const current = mapping[String(noteType.id)];
            if (!current) return null;
            const options = noteType.fields.map((name, index) => ({ name, index }));
            return (
              <section key={noteType.id} className="space-y-3 rounded border border-slate-200 p-4 dark:border-slate-800">
                <h3 className="font-medium">Felder zuordnen — {noteType.name}</h3>
                {(
                  [
                    ["front", "Vorderseite", false],
                    ["back", "Rückseite", false],
                    ["reading", "Lesung", true],
                    ["note", "Notiz", true],
                  ] as const
                ).map(([key, label, optional]) => (
                  <label key={key} className="flex items-center justify-between gap-4 text-sm">
                    <span>{label}</span>
                    <select
                      aria-label={label}
                      value={current[key] === null ? "" : String(current[key])}
                      onChange={(e) =>
                        updateMapping(String(noteType.id), key, e.target.value === "" ? null : Number(e.target.value))
                      }
                      className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
                    >
                      {optional ? <option value="">— keins —</option> : null}
                      {options.map((option) => (
                        <option key={option.index} value={option.index}>
                          {option.name}
                        </option>
                      ))}
                    </select>
                  </label>
                ))}
              </section>
            );
          })}

          <section className="space-y-3 rounded border border-slate-200 p-4 dark:border-slate-800">
            <h3 className="font-medium">Ziel</h3>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Lernbereich</span>
              <select
                value={skillId}
                onChange={(e) => setSkillId(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                {skills.map((skill) => (
                  <option key={skill.manifest.id} value={skill.manifest.id}>
                    {skill.manifest.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center justify-between gap-4 text-sm">
              <span>Modultitel</span>
              <input
                value={moduleTitle}
                onChange={(e) => setModuleTitle(e.target.value)}
                className="rounded border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={keepScheduling}
                onChange={(e) => setKeepScheduling(e.target.checked)}
              />
              <span>Lernstand aus Anki übernehmen</span>
            </label>
          </section>

          <button
            type="button"
            disabled={run.isPending || moduleTitle.trim() === ""}
            onClick={() => run.mutate()}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            Importieren
          </button>
        </>
      ) : null}

      {done ? (
        <p className="rounded border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
          {done.cards} Karten importiert, {done.media} Mediendateien übernommen. Lade die Seite neu, damit der
          Bereich erscheint.
        </p>
      ) : null}
    </div>
  );
}
