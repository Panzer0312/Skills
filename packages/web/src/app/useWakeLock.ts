import { useEffect } from "react";

interface Sentinel {
  release: () => Promise<void>;
  released: boolean;
}
interface WakeLockApi {
  request: (type: "screen") => Promise<Sentinel>;
}

export function useWakeLock(active: boolean): void {
  useEffect(() => {
    if (!active) return;
    const api = (navigator as unknown as { wakeLock?: WakeLockApi }).wakeLock;
    if (!api || typeof api.request !== "function") return;

    let cancelled = false;
    let pending = false;
    let sentinel: Sentinel | null = null;

    const acquire = () => {
      if (cancelled || pending || sentinel) return;
      pending = true;
      try {
        api
          .request("screen")
          .then((s) => {
            pending = false;
            if (cancelled) {
              void s.release().catch(() => {});
              return;
            }
            sentinel = s;
          })
          .catch(() => {
            pending = false;
          });
      } catch {
        pending = false;
      }
    };

    const onVisibility = () => {
      if (document.visibilityState !== "visible") return;
      if (pending) return;
      if (sentinel && sentinel.released === false) return;
      // the browser dropped the lock while the tab was hidden
      sentinel = null;
      acquire();
    };

    acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      const s = sentinel;
      sentinel = null;
      if (s) void s.release().catch(() => {});
    };
  }, [active]);
}
