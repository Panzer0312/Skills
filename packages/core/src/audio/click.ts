export type Subdivision = "viertel" | "achtel" | "triole" | "sechzehntel" | "galopp";

/** One entry per step of a beat; index 0 is the beat itself. */
export const SUBDIVISIONS: Record<Subdivision, { label: string; pattern: boolean[] }> = {
  viertel: { label: "Viertel", pattern: [true] },
  achtel: { label: "Achtel", pattern: [true, true] },
  triole: { label: "Triolen", pattern: [true, true, true] },
  sechzehntel: { label: "Sechzehntel", pattern: [true, true, true, true] },
  galopp: { label: "Galopp", pattern: [true, false, true, true] },
};

export type ClickLevel = "betont" | "schlag" | "unter" | "stumm";

export interface ClickSettings {
  beatsPerBar: number;
  subdivision: Subdivision;
  accents: boolean[];
}

export function defaultAccents(beatsPerBar: number): boolean[] {
  return Array.from({ length: beatsPerBar }, (_, beat) => beat === 0);
}

export function clickLevel(step: number, settings: ClickSettings): ClickLevel {
  const { pattern } = SUBDIVISIONS[settings.subdivision];
  const inBeat = step % pattern.length;
  if (inBeat === 0) {
    const beat = Math.floor(step / pattern.length) % settings.beatsPerBar;
    return settings.accents[beat] ? "betont" : "schlag";
  }
  return pattern[inBeat] ? "unter" : "stumm";
}

export interface SpeedTrainer {
  startBpm: number;
  targetBpm: number;
  stepBpm: number;
  everyBars: number;
}

const MIN_BPM = 20;
const MAX_BPM = 300;

export function speedTrainerBpm(trainer: SpeedTrainer, barsDone: number): number {
  const start = Math.min(MAX_BPM, Math.max(MIN_BPM, trainer.startBpm));
  if (trainer.everyBars <= 0 || trainer.stepBpm <= 0) return start;
  const target = Math.min(MAX_BPM, Math.max(start, trainer.targetBpm));
  const steps = Math.floor(barsDone / trainer.everyBars);
  return Math.min(target, start + steps * trainer.stepBpm);
}
