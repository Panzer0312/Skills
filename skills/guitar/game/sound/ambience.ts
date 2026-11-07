import { GAME_BASE } from "../api.js";

const ALLOWED = new Set(["", "markt", "taverne", "bibliothek", "hafen", "chronik"]);
const ALLOWED_WITH_SUBPATH = new Set(["bibliothek", "hafen"]);

/** Ambience plays only on the calm places, never on quests or tool places. */
export function ambienceAllowed(pathname: string): boolean {
  if (pathname !== GAME_BASE && !pathname.startsWith(`${GAME_BASE}/`)) return false;
  const [first = "", ...rest] = pathname.slice(GAME_BASE.length).split("/").filter(Boolean);
  if (!ALLOWED.has(first)) return false;
  return rest.length === 0 || ALLOWED_WITH_SUBPATH.has(first);
}

const MASTER_GAIN = 0.08;

function brownNoise(ctx: AudioContext): AudioBuffer {
  const length = Math.max(1, Math.floor(ctx.sampleRate * 2));
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
    data[i] = last * 3.5;
  }
  return buffer;
}

/** Quiet harbor: slow waves of brown noise and a soft distant bell. Returns stop. */
export function startAmbience(ctx: AudioContext): () => void {
  const master = ctx.createGain();
  master.gain.setValueAtTime(0, ctx.currentTime);
  master.gain.linearRampToValueAtTime(MASTER_GAIN, ctx.currentTime + 1.5);
  master.connect(ctx.destination);

  const noise = ctx.createBufferSource();
  noise.buffer = brownNoise(ctx);
  noise.loop = true;
  const lowpass = ctx.createBiquadFilter();
  lowpass.type = "lowpass";
  lowpass.frequency.value = 500;
  const swell = ctx.createGain();
  swell.gain.value = 0.6;
  noise.connect(lowpass);
  lowpass.connect(swell);
  swell.connect(master);

  // Waves: a slow oscillator moves the swell gain, period 6 to 9 s.
  const lfo = ctx.createOscillator();
  lfo.frequency.value = 1 / (6 + Math.random() * 3);
  const depth = ctx.createGain();
  depth.gain.value = 0.4;
  lfo.connect(depth);
  depth.connect(swell.gain);
  noise.start();
  lfo.start();

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const scheduleBell = () => {
    timer = setTimeout(() => {
      if (stopped) return;
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = 1568;
      const env = ctx.createGain();
      env.gain.setValueAtTime(0, now);
      env.gain.linearRampToValueAtTime(0.25, now + 0.02);
      env.gain.exponentialRampToValueAtTime(0.001, now + 2.5);
      osc.connect(env);
      env.connect(master);
      osc.start(now);
      osc.stop(now + 2.6);
      scheduleBell();
    }, (20 + Math.random() * 20) * 1000);
  };
  scheduleBell();

  return () => {
    if (stopped) return;
    stopped = true;
    clearTimeout(timer);
    const now = ctx.currentTime;
    master.gain.cancelScheduledValues(now);
    master.gain.setValueAtTime(master.gain.value, now);
    master.gain.linearRampToValueAtTime(0, now + 0.3);
    setTimeout(() => {
      try {
        noise.stop();
        lfo.stop();
      } catch {
        /* already stopped */
      }
      noise.disconnect();
      lfo.disconnect();
      master.disconnect();
    }, 320);
  };
}
