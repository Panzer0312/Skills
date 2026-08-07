import { frequencyOf } from "@skills/core";

/** Plays a short sine at the pitch of the given note, for tuning by ear. */
export function playReferenceTone(noteWithOctave: string, seconds = 2): void {
  const context = new AudioContext();
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequencyOf(noteWithOctave);
  gain.gain.setValueAtTime(0.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.3, context.currentTime + 0.05);
  gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + seconds);

  oscillator.connect(gain);
  gain.connect(context.destination);
  oscillator.start();
  oscillator.stop(context.currentTime + seconds);
  oscillator.onended = () => void context.close();
}
