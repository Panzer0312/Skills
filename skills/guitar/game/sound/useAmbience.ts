import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { useLocation } from "react-router-dom";
import { usePref } from "../usePref.js";
import { getFreeTimerRunning, subscribeFreeTimer } from "../freeTimerStore.js";
import { ambienceAllowed, startAmbience } from "./ambience.js";
import { setSoundEnabled } from "./effects.js";

export function useAmbience(): void {
  const [sound] = usePref("klang.an");
  const { pathname } = useLocation();
  // Free practice is practice too, wherever the timer is started from.
  const freeTimerRunning = useSyncExternalStore(subscribeFreeTimer, getFreeTimerRunning);
  const allowed = sound && ambienceAllowed(pathname) && !freeTimerRunning;
  const [visible, setVisible] = useState(() => document.visibilityState === "visible");
  const ctxRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setSoundEnabled(allowed);
  }, [allowed]);

  useEffect(() => {
    const onChange = () => setVisible(document.visibilityState === "visible");
    document.addEventListener("visibilitychange", onChange);
    return () => document.removeEventListener("visibilitychange", onChange);
  }, []);

  // One lazily created context for the whole shell, closed on unmount.
  useEffect(
    () => () => {
      setSoundEnabled(false);
      const ctx = ctxRef.current;
      ctxRef.current = null;
      if (!ctx) return;
      // Let a running 0.3 s fade finish first.
      setTimeout(() => {
        try {
          void Promise.resolve(ctx.close()).catch(() => undefined);
        } catch {
          /* already closed */
        }
      }, 400);
    },
    [],
  );

  const running = allowed && visible;
  useEffect(() => {
    if (!running) return;
    const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
    if (!Ctor) return;
    let ctx = ctxRef.current;
    if (!ctx) {
      try {
        ctx = new Ctor();
      } catch {
        return;
      }
      ctxRef.current = ctx;
    }
    const live = ctx;
    const resume = () => {
      try {
        void Promise.resolve(live.resume()).catch(() => undefined);
      } catch {
        /* still blocked */
      }
    };
    const onGesture = () => {
      resume();
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
    };
    if (live.state === "suspended") {
      document.addEventListener("pointerdown", onGesture);
      document.addEventListener("keydown", onGesture);
    }
    let stop: (() => void) | undefined;
    try {
      stop = startAmbience(live);
    } catch {
      /* ambience is optional */
    }
    return () => {
      document.removeEventListener("pointerdown", onGesture);
      document.removeEventListener("keydown", onGesture);
      stop?.();
    };
  }, [running]);
}
