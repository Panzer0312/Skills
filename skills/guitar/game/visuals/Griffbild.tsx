import { ChordDiagramSingle } from "../../../../packages/web/src/music/ChordDiagramSingle.js";
import { useChordOverrides } from "../../../../packages/web/src/music/useChordOverrides.js";

/** Chord diagrams for a lesson, one per name, honouring the player's own grips. */
export function Griffbild({ akkorde }: { akkorde: string[] }) {
  const { overrides } = useChordOverrides();
  return (
    <div
      role="group"
      aria-label={`Griffbilder: ${akkorde.join(", ")}`}
      className="my-4 flex flex-wrap gap-3"
    >
      {akkorde.map((name) => (
        <ChordDiagramSingle key={name} name={name} overrides={overrides} />
      ))}
    </div>
  );
}
