import type { ReactNode } from "react";

function Box({ label, tone, children }: { label: string; tone: string; children: ReactNode }) {
  return (
    <div className={`my-4 rounded-lg border-l-4 p-4 ${tone}`}>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide">{label}</div>
      <div className="prose-sm">{children}</div>
    </div>
  );
}

export const Ziel = ({ children }: { children: ReactNode }) => (
  <Box label="Ziel" tone="border-sky-500 bg-sky-50 dark:bg-sky-950">{children}</Box>
);

export const Handhaltung = ({ children }: { children: ReactNode }) => (
  <Box label="Handhaltung" tone="border-violet-500 bg-violet-50 dark:bg-violet-950">{children}</Box>
);

export const Fehlerbild = ({ children }: { children: ReactNode }) => (
  <Box label="Typischer Fehler" tone="border-red-500 bg-red-50 dark:bg-red-950">{children}</Box>
);

export const Uebung = ({ bpm, children }: { bpm?: number; children: ReactNode }) => (
  <Box label={bpm ? `Übung — Ziel ${bpm} BPM` : "Übung"} tone="border-emerald-500 bg-emerald-50 dark:bg-emerald-950">
    {children}
  </Box>
);

export const Merksatz = ({ children }: { children: ReactNode }) => (
  <Box label="Merksatz" tone="border-amber-500 bg-amber-50 dark:bg-amber-950">{children}</Box>
);

export const Hinweis = ({ children }: { children: ReactNode }) => (
  <Box label="Hinweis" tone="border-slate-400 bg-slate-50 dark:bg-slate-900">{children}</Box>
);

export function Checkpoint({ children, onDone }: { children: ReactNode; onDone?: () => void }) {
  return (
    <div className="my-6 rounded-lg border border-slate-300 p-4 dark:border-slate-700">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide">Checkpoint</div>
      <div>{children}</div>
      <button
        type="button"
        onClick={onDone}
        className="mt-3 rounded bg-slate-900 px-3 py-1 text-sm text-white dark:bg-slate-100 dark:text-slate-900"
      >
        Geschafft
      </button>
    </div>
  );
}

export const mdxComponents = { Ziel, Handhaltung, Fehlerbild, Uebung, Merksatz, Hinweis, Checkpoint };
