import { useEffect } from "react";

interface Sentinel {
  release: () => Promise<void>;
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
    let sentinel: Sentinel | null = null;

    const acquire = () => {
      if (cancelled || sentinel) return;
      try {
        api
          .request("screen")
          .then((s) => {
            if (cancelled) {
              void s.release().catch(() => {});
              return;
            }
            sentinel = s;
          })
          .catch(() => {});
      } catch {
        /* silent */
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        // the browser drops the lock when the tab is hidden
        sentinel = null;
        acquire();
      }
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
