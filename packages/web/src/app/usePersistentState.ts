import { useCallback, useState } from "react";

export function usePersistentState<T>(
  key: string,
  initial: T,
  validate: (raw: unknown) => raw is T,
): [T, (next: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (raw === null) return initial;
      const parsed: unknown = JSON.parse(raw);
      return validate(parsed) ? parsed : initial;
    } catch {
      return initial;
    }
  });

  const set = useCallback(
    (next: T) => {
      setValue(next);
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage unavailable: keep in-memory value */
      }
    },
    [key],
  );

  return [value, set];
}
