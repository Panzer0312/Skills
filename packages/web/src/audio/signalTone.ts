const SIGNALS = { start: 880, ende: 440 } as const;

/** Plays a short beep: high to start, low to end. */
export function playSignal(kind: "start" | "ende"): void {
  try {
    beep(SIGNALS[kind]);
  } catch {
    // No audio available: the trainer still works silently.
  }
}

/** Plays a short click for the count-in: high for the accented first beat. */
export function playClick(accent: boolean): void {
  try {
    beep(accent ? 1600 : 900, 0.05, 0.2);
  } catch {
    // No audio available: the count-in still runs silently.
  }
}

function beep(frequency: number, duration = 0.3, volume = 0.3): void {
  const context = new AudioContext();
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + 0.005);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + duration);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => void context.close();
    oscillator.start();
    oscillator.stop(context.currentTime + duration);
  } catch (error) {
    // Close the context a failed setup would otherwise leave open, then let playSignal swallow it.
    void context.close();
    throw error;
  }
}
