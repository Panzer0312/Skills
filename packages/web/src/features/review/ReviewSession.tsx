import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client.js";
import type { ReviewCard } from "../../api/types.js";
import { formatDue } from "./formatDue.js";

const RATINGS = [
  { rating: 1 as const, label: "Nochmal", key: "1" },
  { rating: 2 as const, label: "Schwer", key: "2" },
  { rating: 3 as const, label: "Gut", key: "3" },
  { rating: 4 as const, label: "Leicht", key: "4" },
];

export function ReviewSession() {
  const params = new URLSearchParams(window.location.search);
  const skillId = params.get("skillId");
  const moduleId = params.get("moduleId");
  const queryKey = ["queue", skillId, moduleId];
  const queryClient = useQueryClient();

  const [revealed, setRevealed] = useState(false);
  const [index, setIndex] = useState(0);
  const [shownAt, setShownAt] = useState(() => Date.now());

  const search = new URLSearchParams();
  if (skillId) search.set("skillId", skillId);
  if (moduleId) search.set("moduleId", moduleId);

  const query = useQuery({
    queryKey,
    queryFn: () => api.get<{ cards: ReviewCard[] }>(`/api/queue?${search.toString()}`),
  });

  const rate = useMutation({
    mutationFn: (input: { cardId: number; rating: 1 | 2 | 3 | 4; elapsedMs: number }) =>
      api.post("/api/reviews", input),
    onSuccess: () => {
      setRevealed(false);
      setShownAt(Date.now());
      setIndex((i) => i + 1);
      void queryClient.invalidateQueries({ queryKey: ["stats"] });
    },
  });

  const cards = query.data?.cards ?? [];
  const card = cards[index];

  const submit = useCallback(
    (rating: 1 | 2 | 3 | 4) => {
      if (!card) return;
      rate.mutate({ cardId: card.id, rating, elapsedMs: Date.now() - shownAt });
    },
    [card, rate, shownAt],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === " ") {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!revealed) return;
      const match = RATINGS.find((r) => r.key === event.key);
      if (match) submit(match.rating);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, submit]);

  if (query.isPending) return <p>Wird geladen…</p>;

  if (query.isError) {
    const message = query.error instanceof ApiError ? query.error.message : "Unbekannter Fehler.";
    return (
      <div className="space-y-3">
        <p className="text-red-600 dark:text-red-400">{message}</p>
        <button
          type="button"
          className="rounded border border-slate-300 px-3 py-1 dark:border-slate-700"
          onClick={() => void query.refetch()}
        >
          Erneut versuchen
        </button>
      </div>
    );
  }

  if (!card) {
    return <p className="text-slate-600 dark:text-slate-400">Nichts mehr fällig. Bis später.</p>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <p className="text-sm text-slate-500">
        Karte {index + 1} von {cards.length}
      </p>

      <div className="rounded-lg border border-slate-200 p-8 text-center dark:border-slate-800">
        <div className="text-3xl">{card.front.text}</div>
        {revealed ? (
          <div className="mt-6 border-t border-slate-200 pt-6 dark:border-slate-800">
            {card.back.reading ? <div className="text-lg text-slate-500">{card.back.reading}</div> : null}
            <div className="text-2xl">{card.back.text}</div>
            {card.back.example ? <div className="mt-3 text-sm text-slate-500">{card.back.example}</div> : null}
            {card.back.note ? <div className="mt-2 text-sm text-slate-500">{card.back.note}</div> : null}
          </div>
        ) : null}
      </div>

      {revealed ? (
        <div className="grid grid-cols-4 gap-2">
          {RATINGS.map((entry) => (
            <button
              key={entry.rating}
              type="button"
              disabled={rate.isPending}
              onClick={() => submit(entry.rating)}
              className="rounded border border-slate-300 px-2 py-3 text-sm hover:bg-slate-100 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-900"
            >
              <div className="font-medium">{entry.label}</div>
              <div className="text-xs text-slate-500">
                {formatDue(card.preview[String(entry.rating) as "1" | "2" | "3" | "4"].due, Date.now())}
              </div>
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded bg-slate-900 px-4 py-3 text-white dark:bg-slate-100 dark:text-slate-900"
        >
          Aufdecken (Leertaste)
        </button>
      )}
    </div>
  );
}
