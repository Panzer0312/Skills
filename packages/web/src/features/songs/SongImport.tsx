import { detectFormat, parseSong } from "@skills/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client.js";
import { SongView } from "./SongView.js";

type Mode = "paste" | "url";

const FORMAT_LABELS: Record<string, string> = {
  chordpro: "ChordPro",
  chordsheet: "Akkorde über Text",
  tab: "ASCII-Tabulatur",
};

export function SongImport() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [mode, setMode] = useState<Mode>("paste");
  const [url, setUrl] = useState("");
  const [text, setText] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");

  const parsed = useMemo(() => (text.trim() === "" ? null : parseSong(text)), [text]);
  const format = useMemo(() => (text.trim() === "" ? null : detectFormat(text)), [text]);

  const fetchUrl = useMutation({
    mutationFn: () => api.post<{ text: string; title: string | null }>("/api/songs/fetch", { url }),
    onSuccess: (result) => {
      setText(result.text);
      const song = parseSong(result.text);
      setTitle(result.title ?? song.title);
      setArtist(song.artist ?? "");
    },
  });

  const save = useMutation({
    mutationFn: () =>
      api.post<{ song: { id: number } }>("/api/songs", {
        content: text,
        title: title.trim() || undefined,
        artist: artist.trim() || undefined,
        sourceUrl: mode === "url" && url.trim() !== "" ? url : undefined,
        tags: [],
      }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["songs"] });
      navigate("/skill/guitar/songs");
    },
  });

  function onTextChange(value: string) {
    setText(value);
    if (value.trim() === "") return;
    const song = parseSong(value);
    if (title.trim() === "") setTitle(song.title);
    if (artist.trim() === "" && song.artist) setArtist(song.artist);
  }

  const error = fetchUrl.error ?? save.error;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-semibold">Song hinzufügen</h1>

      <div className="flex gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "paste"} onChange={() => setMode("paste")} />
          <span>Text einfügen</span>
        </label>
        <label className="flex items-center gap-2">
          <input type="radio" checked={mode === "url"} onChange={() => setMode("url")} />
          <span>URL abrufen</span>
        </label>
      </div>

      {mode === "url" ? (
        <div className="flex gap-2">
          <label className="flex-1 text-sm">
            <span className="mb-1 block">Adresse</span>
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://…"
              className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
            />
          </label>
          <button
            type="button"
            disabled={url.trim() === "" || fetchUrl.isPending}
            onClick={() => fetchUrl.mutate()}
            className="self-end rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {fetchUrl.isPending ? "Wird geholt…" : "Abrufen"}
          </button>
        </div>
      ) : null}

      {error ? (
        <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200">
          {error instanceof ApiError ? error.message : "Unbekannter Fehler."}
        </p>
      ) : null}

      <label className="block text-sm">
        <span className="mb-1 block">Songtext</span>
        <textarea
          value={text}
          onChange={(e) => onTextChange(e.target.value)}
          rows={10}
          placeholder="Akkorde und Text hier einfügen — ChordPro, Akkorde über Text oder ASCII-Tab."
          className="w-full rounded border border-slate-300 px-3 py-2 font-mono text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </label>

      {format ? (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Erkanntes Format: <strong>{FORMAT_LABELS[format]}</strong>
        </p>
      ) : null}

      {parsed ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-sm">
              <span className="mb-1 block">Titel</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
            <label className="text-sm">
              <span className="mb-1 block">Interpret</span>
              <input
                value={artist}
                onChange={(e) => setArtist(e.target.value)}
                className="w-full rounded border border-slate-300 px-3 py-2 dark:border-slate-700 dark:bg-slate-900"
              />
            </label>
          </div>

          <SongView song={parsed} />

          <button
            type="button"
            disabled={save.isPending}
            onClick={() => save.mutate()}
            className="rounded bg-slate-900 px-4 py-2 text-white disabled:opacity-50 dark:bg-slate-100 dark:text-slate-900"
          >
            {save.isPending ? "Wird gespeichert…" : "Speichern"}
          </button>
        </>
      ) : null}
    </div>
  );
}
