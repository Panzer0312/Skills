import { frequencyOf, nearestNote, type Tuning } from "../music/notes.js";

export interface PitchOptions {
  threshold?: number;
  minFrequency?: number;
  maxFrequency?: number;
  minRms?: number;
}

export interface TuningReading {
  frequency: number;
  note: string;
  cents: number;
  targetString: number | null;
}

function rms(buffer: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < buffer.length; i += 1) sum += buffer[i]! * buffer[i]!;
  return Math.sqrt(sum / buffer.length);
}

/**
 * YIN pitch detection. Steps 1-4 of the paper: difference function,
 * cumulative mean normalisation, absolute threshold, parabolic interpolation.
 */
export function detectPitch(
  buffer: Float32Array,
  sampleRate: number,
  options: PitchOptions = {},
): number | null {
  const threshold = options.threshold ?? 0.15;
  const minFrequency = options.minFrequency ?? 60;
  const maxFrequency = options.maxFrequency ?? 1400;
  const minRms = options.minRms ?? 0.01;

  if (rms(buffer) < minRms) return null;

  // The lower search bound is intentionally NOT derived from maxFrequency: a tone
  // above maxFrequency still has true periodicity at a short lag, and skipping that
  // region would let the search lock onto a harmonic alias within [minLag, maxLag]
  // and report it as if it were a valid in-range pitch. Searching from a small
  // constant lag finds the true (out-of-range) period, which the final frequency
  // bounds check below then correctly rejects.
  const minLag = 2;
  const maxLag = Math.min(Math.floor(sampleRate / minFrequency), Math.floor(buffer.length / 2));
  if (maxLag <= minLag) return null;

  const difference = new Float32Array(maxLag + 1);
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let sum = 0;
    for (let i = 0; i < maxLag; i += 1) {
      const delta = buffer[i]! - buffer[i + lag]!;
      sum += delta * delta;
    }
    difference[lag] = sum;
  }

  const normalised = new Float32Array(maxLag + 1);
  normalised[0] = 1;
  let runningSum = 0;
  for (let lag = 1; lag <= maxLag; lag += 1) {
    runningSum += difference[lag]!;
    normalised[lag] = runningSum === 0 ? 1 : (difference[lag]! * lag) / runningSum;
  }

  let bestLag = -1;
  for (let lag = minLag; lag <= maxLag; lag += 1) {
    if (normalised[lag]! < threshold) {
      while (lag + 1 <= maxLag && normalised[lag + 1]! < normalised[lag]!) lag += 1;
      bestLag = lag;
      break;
    }
  }

  if (bestLag === -1) {
    let lowest = Number.POSITIVE_INFINITY;
    for (let lag = minLag; lag <= maxLag; lag += 1) {
      if (normalised[lag]! < lowest) {
        lowest = normalised[lag]!;
        bestLag = lag;
      }
    }
    if (lowest > 0.5) return null;
  }

  const previous = normalised[bestLag - 1] ?? normalised[bestLag]!;
  const next = normalised[bestLag + 1] ?? normalised[bestLag]!;
  const denominator = 2 * (2 * normalised[bestLag]! - previous - next);
  const refinedLag = denominator === 0 ? bestLag : bestLag + (next - previous) / denominator;

  const frequency = sampleRate / refinedLag;
  if (frequency < minFrequency || frequency > maxFrequency) return null;
  return frequency;
}

export function readTuning(
  buffer: Float32Array,
  sampleRate: number,
  tuning: Tuning,
  options: PitchOptions = {},
): TuningReading | null {
  const frequency = detectPitch(buffer, sampleRate, options);
  if (frequency === null) return null;

  // Cents are reported relative to the nearest string, not the nearest chromatic
  // note: a string that is nearly a quarter-tone flat can sit closer to the
  // neighbouring semitone than to its own open pitch, which would otherwise flip
  // the sign of the reading the player actually cares about.
  let targetString: number | null = null;
  let smallestAbsCents = Number.POSITIVE_INFINITY;
  let cents = 0;
  tuning.strings.forEach((stringNote, index) => {
    const distance = 1200 * Math.log2(frequency / frequencyOf(stringNote));
    const absDistance = Math.abs(distance);
    if (absDistance < smallestAbsCents) {
      smallestAbsCents = absDistance;
      cents = Math.round(distance);
      targetString = index;
    }
  });

  // More than three semitones away means the player is not on that string at all.
  if (smallestAbsCents > 300) targetString = null;

  const note = targetString !== null ? tuning.strings[targetString]! : nearestNote(frequency).note;
  if (targetString === null) cents = nearestNote(frequency).cents;

  return { frequency, note, cents, targetString };
}
