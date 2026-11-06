const FLOOR_DB = -60;

/** Input level from 0 to 1, linear in dB from -60 to 0 dBFS (RMS). */
export function inputLevel(buffer: Float32Array): number {
  if (buffer.length === 0) return 0;
  let sum = 0;
  for (const sample of buffer) sum += sample * sample;
  const rms = Math.sqrt(sum / buffer.length);
  if (rms === 0) return 0;
  const db = 20 * Math.log10(rms);
  return Math.min(1, Math.max(0, (db - FLOOR_DB) / -FLOOR_DB));
}
