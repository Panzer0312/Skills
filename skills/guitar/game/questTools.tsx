import type { QuestDefinition, ScaledQuest } from "@skills/core";
import type { ReactNode } from "react";
import { gameContent } from "./api.js";
import { ChordTrainer } from "./ChordTrainer.js";
import { FretOverlay } from "./FretOverlay.js";
import { NoteFinder } from "./NoteFinder.js";
import { RiffCard } from "./RiffViewer.js";
import { Griffbild } from "./visuals/index.js";

export interface QuestToolProps {
  quest: QuestDefinition;
  scaled: ScaledQuest;
  level: number;
  state: unknown;
  setBpm: (bpm: number) => void;
  countInBpm: number | undefined;
  onResult: (n: number) => void;
  onRunningChange: (running: boolean) => void;
  cancelSignal: number;
}

export interface QuestTool {
  id: string;
  applies: (q: QuestDefinition) => boolean;
  render: (p: QuestToolProps) => ReactNode;
}

/** Tools a quest shows, in screen order. */
export const QUEST_TOOLS: QuestTool[] = [
  {
    id: "griffbild",
    applies: (q) => Boolean(q.chords),
    render: ({ quest }) => (quest.chords ? <Griffbild akkorde={quest.chords} /> : null),
  },
  {
    id: "riff",
    applies: (q) => gameContent.riffs.some((entry) => entry.id === q.riffId),
    render: ({ quest, scaled, setBpm }) => {
      const riff = gameContent.riffs.find((entry) => entry.id === quest.riffId);
      return riff ? (
        <RiffCard
          riff={riff}
          onTempo={setBpm}
          bpm={scaled.bpm ?? undefined}
          inQuest
          questId={quest.id}
          tuningLinked={Boolean(quest.tuning)}
        />
      ) : null;
    },
  },
  {
    id: "fretOverlay",
    applies: (q) => Boolean(q.fretboard),
    render: ({ quest }) =>
      quest.fretboard ? (
        <FretOverlay
          root={quest.fretboard.root}
          scale={quest.fretboard.scale}
          box={quest.fretboard.box as 1 | 2 | 3 | 4 | 5 | undefined}
          caged={quest.fretboard.caged}
        />
      ) : null,
  },
  {
    id: "chordTrainer",
    applies: (q) => q.kind === "wechsel",
    render: ({ scaled, countInBpm, onRunningChange, cancelSignal, onResult }) =>
      scaled.chordPair ? (
        <ChordTrainer
          pair={scaled.chordPair}
          countInBpm={countInBpm}
          onRunningChange={onRunningChange}
          cancelSignal={cancelSignal}
          onResult={onResult}
        />
      ) : null,
  },
  {
    id: "noteFinder",
    applies: (q) => Boolean(q.noteGame),
    render: ({ quest, onRunningChange, cancelSignal, onResult }) =>
      quest.noteGame ? (
        <NoteFinder
          strings={quest.noteGame.strings}
          tuning={quest.tuning ?? "Standard"}
          onRunningChange={onRunningChange}
          cancelSignal={cancelSignal}
          onResult={onResult}
        />
      ) : null,
  },
];
