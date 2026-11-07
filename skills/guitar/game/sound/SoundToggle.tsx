import { usePref } from "../usePref.js";

export function SoundToggle() {
  const [on, setOn] = usePref("klang.an");
  return (
    <button type="button" className="game-button" aria-pressed={on} onClick={() => setOn(!on)}>
      {on ? "Klang an" : "Klang aus"}
    </button>
  );
}
