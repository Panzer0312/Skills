import type { MapNode, Tips } from "@skills/core";
import type { ReactNode } from "react";
import { spriteUrl, type SpriteName } from "../assets.js";

function Tip({ sprite, title, children }: { sprite: SpriteName; title: string; children: ReactNode }) {
  return (
    <div className="tips-entry">
      <img src={spriteUrl(sprite)} alt="" />
      <div>
        <h3>{title}</h3>
        {children}
      </div>
    </div>
  );
}

export function TipsBoard({
  tips,
  nodes,
  onSelect,
}: {
  tips: Tips;
  nodes: MapNode[];
  onSelect: (id: string) => void;
}) {
  const { best, quick } = tips;
  const bestNode = best ? nodes.find((node) => node.id === best.lessonId) : undefined;
  return (
    <section className="tips-board" aria-label="Tips Board">
      <h2>Tips Board</h2>
      {best ? (
        <Tip sprite="key" title="Bester nächster Schritt">
          <button type="button" className="map-text-button" onClick={() => onSelect(best.lessonId)}>
            {bestNode?.title ?? best.lessonId}
          </button>
          <p>{best.reason}</p>
        </Tip>
      ) : null}
      {tips.moreComing ? <p>Alle fertigen Lektionen auf dem Hauptweg sind geschafft. Weitere folgen.</p> : null}
      {quick ? (
        <Tip sprite="ruby" title={quick.refine ? "Verfeinern" : "Schneller Erfolg"}>
          <button type="button" className="map-text-button" onClick={() => onSelect(quick.node.id)}>
            {quick.node.title}
          </button>
        </Tip>
      ) : null}
      <Tip sprite="parchment" title="Bleib auf Kurs">
        <p>{tips.stayOnTrack}</p>
      </Tip>
    </section>
  );
}
