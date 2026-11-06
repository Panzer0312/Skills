import { useCallback, useEffect, useRef, useState } from "react";

export type MicState = "idle" | "requesting" | "running" | "denied" | "unsupported" | "error";

interface Options {
  onBuffer: (buffer: Float32Array, sampleRate: number) => void;
  fftSize?: number;
  deviceId?: string | null;
  onDeviceLost?: () => void;
}

const PROCESSING_OFF = { echoCancellation: false, noiseSuppression: false, autoGainControl: false };

export function useMicrophone(options: Options) {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);

  const contextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const frameRef = useRef<number | null>(null);
  const callbackRef = useRef(options.onBuffer);
  callbackRef.current = options.onBuffer;
  const deviceRef = useRef(options.deviceId ?? null);
  deviceRef.current = options.deviceId ?? null;
  const lostRef = useRef(options.onDeviceLost);
  lostRef.current = options.onDeviceLost;
  // The device the open stream really uses; it differs from the choice after a fallback.
  const activeDeviceRef = useRef<string | null>(null);
  // Counts every start and stop, so a getUserMedia result that arrives late can tell it is stale.
  const generationRef = useRef(0);
  const pendingRef = useRef(false);
  const requestedDeviceRef = useRef<string | null>(null);

  const release = useCallback(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    void contextRef.current?.close();
    contextRef.current = null;
  }, []);

  const stop = useCallback(() => {
    generationRef.current += 1;
    pendingRef.current = false;
    release();
    setState("idle");
  }, [release]);

  const run = useCallback(
    async (forceDefault: boolean) => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setState("unsupported");
        setError("Dieser Browser bietet keinen Mikrofonzugriff an.");
        return;
      }

      generationRef.current += 1;
      const generation = generationRef.current;
      const stale = () => generation !== generationRef.current;
      release();
      pendingRef.current = true;
      setState("requesting");
      setError(null);
      let lost = forceDefault;
      const wanted = forceDefault ? null : deviceRef.current;
      requestedDeviceRef.current = wanted;
      const dropStale = (stream: MediaStream) => stream.getTracks().forEach((track) => track.stop());

      try {
        let stream: MediaStream;
        if (wanted === null) {
          stream = await navigator.mediaDevices.getUserMedia({ audio: PROCESSING_OFF });
        } else {
          try {
            stream = await navigator.mediaDevices.getUserMedia({
              audio: { deviceId: { exact: wanted }, ...PROCESSING_OFF },
            });
          } catch (e) {
            if (stale() || errorName(e) !== "OverconstrainedError") throw e;
            requestedDeviceRef.current = null;
            stream = await navigator.mediaDevices.getUserMedia({ audio: PROCESSING_OFF });
            if (!stale()) {
              activeDeviceRef.current = null;
              lostRef.current?.();
            }
            lost = true;
          }
        }
        if (stale()) {
          dropStale(stream);
          return;
        }
        pendingRef.current = false;
        activeDeviceRef.current = lost ? null : wanted;
        streamRef.current = stream;

        // Unplugging the interface ends the track without any error; move to the default device.
        stream.getTracks().forEach((track) => {
          track.onended = () => {
            if (stale()) return;
            release();
            activeDeviceRef.current = null;
            lostRef.current?.();
            void run(true);
          };
        });

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
        if (lost) setError("Das gewählte Eingabegerät ist nicht da. Das Standardgerät wird benutzt.");
      } catch (e) {
        if (stale()) return;
        pendingRef.current = false;
        release();
        const name = errorName(e);
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
    },
    [options.fftSize, release],
  );

  const start = useCallback(() => run(false), [run]);

  useEffect(() => stop, [stop]);

  // A new choice while the microphone runs, or is being requested, moves it over to that device.
  const wantedDevice = options.deviceId ?? null;
  useEffect(() => {
    if (streamRef.current === null && !pendingRef.current) return;
    const current = pendingRef.current ? requestedDeviceRef.current : activeDeviceRef.current;
    if (current === wantedDevice) return;
    stop();
    void start();
  }, [wantedDevice, start, stop]);

  return { state, error, start, stop };
}

function errorName(e: unknown): string {
  return typeof e === "object" && e !== null && "name" in e ? String((e as { name: unknown }).name) : "";
}
