const SIGNALS = { start: 880, ende: 440 } as const;

/** Plays a short beep: high to start, low to end. */
export function playSignal(kind: "start" | "ende"): void {
  try {
    beep(SIGNALS[kind]);
  } catch {
    // No audio available: the trainer still works silently.
  }
}

function beep(frequency: number): void {
  const context = new AudioContext();
  try {
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.3, context.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.3);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.onended = () => void context.close();
    oscillator.start();
    oscillator.stop(context.currentTime + 0.3);
  } catch (error) {
    // Close the context a failed setup would otherwise leave open, then let playSignal swallow it.
    void context.close();
    throw error;
  }
}
