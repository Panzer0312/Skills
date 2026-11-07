import { useEffect, useState } from "react";
import { usePref } from "../usePref.js";

export type MicPermission = "unknown" | "denied" | "ok" | "unsupported";
export type Guitar = "ja" | "nein" | "spaeter";

export interface Devices {
  mic: MicPermission;
  guitar: Guitar;
  canUse: (what: "mic") => boolean;
}

/** The microphone permission without asking for it; "unknown" when the browser cannot tell. */
export function useDevices(): Devices {
  const [guitar] = usePref("geraete.gitarreAmMikro");
  const [mic, setMic] = useState<MicPermission>("unknown");

  useEffect(() => {
    let cancelled = false;
    let status: PermissionStatus | null = null;
    const apply = () => {
      if (cancelled || !status) return;
      setMic(status.state === "denied" ? "denied" : status.state === "granted" ? "ok" : "unknown");
    };
    try {
      if (typeof navigator !== "undefined" && !navigator.mediaDevices?.getUserMedia) {
        setMic("unsupported");
        return;
      }
      const query = navigator.permissions?.query?.({ name: "microphone" as PermissionName });
      if (!query) return;
      query
        .then((s) => {
          status = s;
          apply();
          try {
            s.onchange = apply;
          } catch {
            // Without change events the state is read once.
          }
        })
        .catch(() => {});
    } catch {
      // Stays "unknown".
    }
    return () => {
      cancelled = true;
      try {
        if (status) status.onchange = null;
      } catch {
        // Nothing to clean up.
      }
    };
  }, []);

  return { mic, guitar, canUse: (what) => what === "mic" && guitar === "ja" && mic !== "denied" && mic !== "unsupported" };
}
