import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "running" | "denied" | "unsupported" | "error";

interface Options {
  onBuffer: (buffer: Float32Array, sampleRate: number) => void;
  fftSize?: number;
}

export function useMicrophone(options: Options) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const callbackRef = useRef(options.onBuffer);
  callbackRef.current = options.onBuffer;

  const stop = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
    setState("idle");
  }, []);

  const start = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError("Dieser Browser bietet keinen Mikrofonzugriff an.");
      return;
    }

    setState("requesting");
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      streamRef.current = stream;

      const context = new AudioContext();
      contextRef.current = context;

      const source = context.createMediaStreamSource(stream);
      const analyser = context.createAnalyser();
      analyser.fftSize = options.fftSize ?? 4096;
      source.connect(analyser);

      const buffer = new Float32Array(analyser.fftSize);
      const tick = () => {
        analyser.getFloatTimeDomainData(buffer);
        callbackRef.current(buffer, context.sampleRate);
        frameRef.current = requestAnimationFrame(tick);
      };
      frameRef.current = requestAnimationFrame(tick);

      setState("running");
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setError(
          "Der Zugriff auf das Mikrofon wurde abgelehnt. Erlaube ihn in den Browser-Einstellungen für diese Seite — der Rest der App funktioniert weiter.",
        );
      } else if (name === "NotFoundError") {
        setState("error");
        setError("Es wurde kein Mikrofon gefunden.");
      } else {
        setState("error");
        setError(e instanceof Error ? e.message : "Unbekannter Fehler beim Mikrofonzugriff.");
      }
    }
  }, [options.fftSize]);

  useEffect(() => stop, [stop]);

  return { state, error, start, stop };
}
