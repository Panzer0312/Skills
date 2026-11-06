import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "audio.inputDevice";

export interface InputDevice {
  id: string;
  label: string;
}

function readChoice(): string | null {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeChoice(id: string | null) {
  try {
    if (id === null) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // The choice then only lasts for this page.
  }
}

/** The audio inputs of this machine. Labels stay empty until the microphone was allowed once. */
export function useInputDevices() {
  const [devices, setDevices] = useState<InputDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(readChoice);

  const refresh = useCallback(async () => {
    try {
      const all = (await navigator.mediaDevices?.enumerateDevices?.()) ?? [];
      setDevices(
        all
          .filter((device) => device.kind === "audioinput")
          .map((device, index) => ({ id: device.deviceId, label: device.label || `Eingang ${index + 1}` })),
      );
    } catch {
      setDevices([]);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const media = typeof navigator === "undefined" ? undefined : navigator.mediaDevices;
    media?.addEventListener?.("devicechange", refresh);
    return () => media?.removeEventListener?.("devicechange", refresh);
  }, [refresh]);

  const select = useCallback((id: string | null) => {
    setDeviceId(id);
    writeChoice(id);
  }, []);

  return { devices, deviceId, select, refresh };
}
