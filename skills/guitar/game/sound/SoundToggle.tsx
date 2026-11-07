import { useGameState, useSoundSetting } from "../api.js";

export function SoundToggle() {
  const on = useGameState().data?.sound === true;
  const setting = useSoundSetting();
  return (
    <button
      type="button"
      className="game-button"
      aria-pressed={on}
      disabled={setting.isPending}
      onClick={() => setting.mutate(!on)}
    >
      {on ? "Klang an" : "Klang aus"}
    </button>
  );
}
