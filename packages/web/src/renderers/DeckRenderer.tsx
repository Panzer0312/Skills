import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { api } from "../api/client.js";
import type { ReviewCard } from "../api/types.js";

export function DeckRenderer({
  skillId,
  moduleId,
  title,
}: {
  skillId: string;
  moduleId: string;
  title: string;
}) {
  const query = useQuery({
    queryKey: ["queue", skillId, moduleId],
    queryFn: () =>
      api.get<{ cards: ReviewCard[] }>(`/api/queue?skillId=${skillId}&moduleId=${moduleId}`),
  });

  const due = query.data?.cards.length ?? 0;

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold">{title}</h1>
      <p className="text-slate-600 dark:text-slate-400">{due} Karten sind fällig.</p>
      <Link
        to={`/review?skillId=${skillId}&moduleId=${moduleId}`}
        className="inline-block rounded bg-slate-900 px-4 py-2 text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Wiederholen
      </Link>
      <a
        href={`/api/anki/export/${skillId}/${moduleId}`}
        className="ml-2 inline-block rounded border border-slate-300 px-4 py-2 text-sm dark:border-slate-700"
      >
        Als Anki-Deck exportieren
      </a>
    </div>
  );
}
