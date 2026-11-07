let enabled = false;

export function setSoundEnabled(on: boolean): void {
  enabled = on;
}

type Blip = { freq: number; start: number; dur: number; type: OscillatorType; gain: number };

function play(blips: Blip[]): void {
  const Ctor = (globalThis as { AudioContext?: typeof AudioContext }).AudioContext;
  if (!Ctor) return;
  try {
    const ctx = new Ctor();
    void ctx.resume?.();
    const end = Math.max(...blips.map((b) => b.start + b.dur));
    for (const b of blips) {
      const t = ctx.currentTime + b.start;
      const osc = ctx.createOscillator();
      osc.type = b.type;
      osc.frequency.value = b.freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(b.gain, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + b.dur);
      osc.connect(g);
      g.connect(ctx.destination);
      osc.start(t);
      osc.stop(t + b.dur);
    }
    setTimeout(() => void ctx.close?.(), (end + 0.1) * 1000);
  } catch {
    /* sound is optional */
  }
}

export function playEffect(kind: "coin" | "equip"): void {
  if (!enabled) return;
  if (kind === "coin") {
    play([
      { freq: 988, start: 0, dur: 0.06, type: "square", gain: 0.1 },
      { freq: 1319, start: 0.06, dur: 0.06, type: "square", gain: 0.1 },
    ]);
  } else {
    play([{ freq: 110, start: 0, dur: 0.14, type: "triangle", gain: 0.15 }]);
  }
}
