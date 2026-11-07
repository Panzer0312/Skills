import { useCallback, useEffect, useRef, useState } from "react";
import { story } from "../api.js";
import { usePref } from "../usePref.js";
import { dismissIntro, resetIntroDismissed, useIntroDismissed } from "./dismissed.js";
import { onIntroStep } from "./helpBus.js";
import data from "./intro.json";
import "./intro.css";

interface IntroStep {
  id: string;
  target: string | null;
  title: string;
  text: string;
  place?: string;
}

const STEPS = data.steps as IntroStep[];

type Box = { top: number; left: number; width: number; height: number };

function measure(target: string | null): Box | null {
  if (!target) return null;
  const el = document.querySelector<HTMLElement>(`[data-intro="${target}"]`);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 && r.height === 0) return null;
  return {
    top: r.top - 6,
    left: r.left - 6,
    width: r.width + 12,
    height: r.height + 12,
  };
}

/** Meister Orlo's intro: shown once on first launch, or one step at a time from a "?" button. */
export function IntroTour() {
  const [seen, setSeen, { loading }] = usePref("intro.gesehen");
  const [index, setIndex] = useState(0);
  const [help, setHelp] = useState<number | null>(null);
  const [box, setBox] = useState<Box | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);

  const dismissed = useIntroDismissed();
  const touring = !loading && !seen && !dismissed;

  // Replay (seen turned false again) clears the local dismissal.
  const prevSeen = useRef(seen);
  useEffect(() => {
    if (prevSeen.current && !seen) resetIntroDismissed();
    prevSeen.current = seen;
  }, [seen]);
  const active = help !== null ? help : touring ? index : null;
  const step = active !== null ? STEPS[active] : undefined;

  useEffect(
    () =>
      onIntroStep((id) => {
        const i = STEPS.findIndex((s) => s.id === id);
        if (i >= 0) setHelp(i);
      }),
    [],
  );

  const finish = useCallback(() => {
    setIndex(0);
    dismissIntro();
    setSeen(true);
  }, [setSeen]);
  const close = useCallback(() => {
    if (help !== null) setHelp(null);
    else finish();
  }, [help, finish]);

  // Spotlight: follow the target while the step is open.
  useEffect(() => {
    if (!step) return;
    const el = step.target
      ? document.querySelector<HTMLElement>(`[data-intro="${step.target}"]`)
      : null;
    if (typeof el?.scrollIntoView === "function")
      el.scrollIntoView({ block: "center", behavior: "auto" });
    let retries = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const update = () => {
      const next = measure(step.target);
      setBox(next);
      // The target may mount a moment later (route change, data load).
      if (!next && step.target && retries++ < 15) timer = setTimeout(update, 200);
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [step]);

  // Restore focus to where it was when the tour opened.
  const isOpen = step !== undefined;
  useEffect(() => {
    if (!isOpen) return;
    const before = document.activeElement as HTMLElement | null;
    return () => {
      if (before && before.isConnected && typeof before.focus === "function") before.focus();
    };
  }, [isOpen]);

  // While open: Esc/Tab are handled at document level, and no key reaches page handlers.
  const closeRef = useRef(() => {});
  closeRef.current = close;
  useEffect(() => {
    if (!isOpen) return;
    const items = () =>
      Array.from(dialogRef.current?.querySelectorAll<HTMLElement>("button:not([disabled])") ?? []);
    const onKey = (event: KeyboardEvent) => {
      event.stopPropagation();
      if (event.key === "Escape") {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const list = items();
      if (list.length === 0) return;
      const first = list[0]!;
      const final = list[list.length - 1]!;
      const active = document.activeElement as HTMLElement | null;
      const inside = !!active && !!dialogRef.current?.contains(active);
      if (!inside || (event.shiftKey && active === first)) {
        event.preventDefault();
        (event.shiftKey ? final : first).focus();
      } else if (!event.shiftKey && active === final) {
        event.preventDefault();
        first.focus();
      }
    };
    const onFocusIn = (event: FocusEvent) => {
      if (dialogRef.current && !dialogRef.current.contains(event.target as Node)) nextRef.current?.focus();
    };
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("keyup", onKey, true);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      document.removeEventListener("keydown", onKey, true);
      document.removeEventListener("keyup", onKey, true);
      document.removeEventListener("focusin", onFocusIn);
    };
  }, [isOpen]);

  // Focus starts on Weiter (or Schließen in help mode) at every step.
  useEffect(() => {
    if (step) nextRef.current?.focus();
  }, [step]);

  if (!step || active === null) return null;
  const last = active === STEPS.length - 1;

  return (
    <div className="intro-layer">
      {box ? (
        <div
          className="intro-spot"
          style={{
            top: box.top,
            left: box.left,
            width: box.width,
            height: box.height,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="intro-dim" aria-hidden="true" />
      )}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="intro-title"
        className={`intro-card game-panel${box ? " intro-card-low" : ""}`}
      >
        <p className="intro-who">
          {story.mentor.name}
          <small> · {story.mentor.role}</small>
        </p>
        <h2 id="intro-title">{step.title}</h2>
        <p>{step.text}</p>
        <div className="intro-actions">
          {help === null ? (
            <>
              <button
                type="button"
                className="game-button"
                disabled={active === 0}
                onClick={() => setIndex(active - 1)}
              >
                Zurück
              </button>
              <button
                ref={nextRef}
                type="button"
                className="game-button"
                onClick={() => (last ? finish() : setIndex(active + 1))}
              >
                {last ? "Fertig" : "Weiter"}
              </button>
              <button
                type="button"
                className="game-button intro-skip"
                onClick={finish}
              >
                Überspringen
              </button>
            </>
          ) : (
            <button
              ref={nextRef}
              type="button"
              className="game-button"
              onClick={() => setHelp(null)}
            >
              Schließen
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
