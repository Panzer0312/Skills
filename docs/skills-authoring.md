# Einen neuen Lernbereich anlegen

Ein Lernbereich („Skill") ist ein Ordner unter `skills/`. Der Kern wird dafür **nicht** angefasst.

## Minimalbeispiel

```
skills/kochen/
  skill.json
  decks/grundlagen.json
```

`skills/kochen/skill.json`:

```json
{
  "id": "kochen",
  "name": "Kochen",
  "icon": "chef-hat",
  "accent": "#c2410c",
  "description": "Grundtechniken der Küche.",
  "modules": [
    { "id": "grundlagen", "type": "srs-deck", "title": "Grundbegriffe", "data": ["decks/grundlagen.json"] }
  ]
}
```

`skills/kochen/decks/grundlagen.json`:

```json
{
  "deck": "Grundbegriffe",
  "cards": [
    { "key": "blanchieren", "front": "Blanchieren", "back": "Kurz in kochendes Wasser, dann in Eiswasser.", "tags": ["technik"] }
  ]
}
```

Neu laden — der Bereich erscheint in der Seitenleiste, die Karten sind in der Warteschlange.

## Manifest-Referenz

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | ja | Slug aus Kleinbuchstaben, Ziffern, Bindestrichen. Eindeutig. |
| `name` | ja | Anzeigename |
| `icon` | ja | Name eines lucide-Icons |
| `accent` | ja | Hex-Farbe, z. B. `#4f46e5` |
| `description` | nein | Ein Satz für die Übersicht |
| `entry` | nein | Pfad, zu dem `/skill/<id>` statt zur Bereichsübersicht weiterleitet |
| `modules` | ja | Mindestens ein Modul |

Pro Modul:

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `id` | ja | Slug, eindeutig innerhalb des Bereichs |
| `type` | ja | `course`, `srs-deck`, `reference`, `practice`, `library` |
| `title` | ja | Überschrift |
| `subtitle` | nein | Zusatzzeile in der Bereichsübersicht |
| `pinned` | nein | `true` setzt einen Schnellzugriff in die Kopfleiste |
| `widget` | nein | Dateiname (ohne `.tsx`) aus `widgets/` |
| `data` | nein | Pfade relativ zum Bereichsordner, `*` erlaubt |
| `dailyNewLimit` | nein | Überschreibt das globale Limit |
| `dailyReviewLimit` | nein | Überschreibt das globale Limit |
| `fullscreen` | nein | `true` macht das Modul zusätzlich unter `/vollbild/<skill>/<modul>/*` erreichbar, ohne Seitenleiste |
| `redirect` | nein | Pfad, zu dem die normale Modulseite weiterleitet |

## Einstieg, Weiterleitung und Vollbild

Mit diesen drei Feldern kann ein Lernbereich als eigene Vollbild-App laufen. `skills/guitar/skill.json`
macht es vor:

```json
{
  "entry": "/vollbild/guitar/spiel",
  "modules": [
    { "id": "spiel", "type": "practice", "title": "Spiel", "fullscreen": true, "widget": "GameApp" },
    { "id": "stimmgeraet", "type": "practice", "title": "Stimmgerät", "redirect": "/vollbild/guitar/spiel/schrein" }
  ]
}
```

- **`entry`** ersetzt die Bereichsübersicht: Wer den Lernbereich öffnet, landet direkt dort.
- **`fullscreen`** gibt dem Modul die Route `/vollbild/<skill>/<modul>/*`. Alles hinter dem Modul gehört
  dem Widget, es kann darin eigene Routen anlegen. Module ohne `fullscreen` gibt es unter diesem Pfad nicht.
- **`redirect`** leitet die normale Modulseite weiter, das Modul bleibt aber in der Navigation sichtbar.
  So führt ein alter Link oder ein Schnellzugriff (`pinned`) zum passenden Ort in der Vollbild-App.
  Die Vollbild-Route selbst folgt `redirect` nicht.

## Modultypen

- **`srs-deck`** — Karten aus `decks/*.json` im Format `{ "deck": string, "cards": Card[] }`.
  Eine Karte: `{ key, front, back, reading?, note?, example?, tags? }`. **`key` muss stabil sein** —
  er ist die Identität der Karte. Wer ihn ändert, erzeugt eine neue Karte und verliert den Fortschritt.
- **`course`** — Lektionen aus `lessons/*.mdx`. Jede Datei exportiert
  `export const meta = { id, title, order, requires }`. `requires` nennt die `id` einer Lektion,
  die vorher abgeschlossen sein muss, oder `null`.
- **`reference`** — Nachschlagen. Standardmäßig als Tabelle aus einem JSON-Array von Objekten.
- **`practice`** — freies Üben. Braucht in aller Regel ein eigenes Widget.
- **`library`** — Sammlung, die der Nutzer selbst füllt.

## MDX-Bausteine für Lektionen

`<Ziel>`, `<Handhaltung>`, `<Fehlerbild>`, `<Uebung bpm={80}>`, `<Merksatz>`, `<Hinweis>`, `<Checkpoint>`.
`<Checkpoint>` schließt die Lektion beim Klick ab.

Eine MDX-Lektion darf außerdem Komponenten importieren, die im Skill selbst liegen (etwa die Gitarren-Visualisierungen unter `skills/guitar/`), und sie wie die Bausteine oben einsetzen.

## Eigenes Widget

Lege `skills/<id>/widgets/MeinWidget.tsx` an und trage `"widget": "MeinWidget"` im Modul ein.

```tsx
import type { WidgetProps } from "../../../packages/web/src/skills/widgets.js";

export default function MeinWidget({ data, progress }: WidgetProps) {
  return (
    <div>
      <h1 className="text-2xl font-semibold">Mein Widget</h1>
      <p>{data.length} Einträge geladen.</p>
      <button onClick={() => progress.record("uebung-1", "correct")}>Geschafft</button>
    </div>
  );
}
```

Ein Widget spricht **nie** direkt mit der Datenbank. Es bekommt `data`, `progress` und `settings` —
mehr braucht es nicht, und mehr darf es nicht nutzen.

**Wichtig für `data`:** `ModuleRoute` sammelt die Dateien aus dem Manifest-Eintrag `data`, und wenn eine
Datei ein Array ist, spreadet es deren Einträge einzeln in die flache `data`-Liste des Widgets (nötig,
damit generische Renderer wie `ReferenceRenderer` flache Tabellenzeilen bekommen). Ein Widget bekommt
also nie „die ganze Datei X als ein Element" — bei array-förmigen Dateien muss es die passenden Einträge
selbst aus der flachen Liste herausfiltern (z. B. per Zod-Schema, siehe `skills/japanese/widgets/ReadingTrainer.tsx`).
Objektförmige Dateien (wie eine `{ script, entries }`-Kana-Datei) landen dagegen unverändert als ein
Element in `data`.

## Fortschritt und Inhaltsänderungen

Der Seed-Abgleich läuft bei jedem App-Start. Karten hinzufügen ist gefahrlos. Karten entfernen
archiviert sie, löscht sie aber nicht — kommen sie zurück, kommt der alte Lernstand mit.

## Anki-Decks als Modul

Über „Anki-Import" in der Seitenleiste lässt sich eine `.apkg`-Datei in einen bestehenden Lernbereich
importieren. Sie wird zu einem `srs-deck`-Modul und nutzt denselben Scheduler wie die mitgelieferten
Inhalte. Importierte Module stehen **nicht** im Manifest — sie leben nur in der Datenbank.

Kartenschlüssel importierter Karten haben die Form `apkg-<anki-note-id>-<template-ord>`. Ein erneuter
Import derselben Datei aktualisiert die Karten, statt sie zu verdoppeln.

Ein importiertes oder mitgeliefertes `srs-deck`-Modul lässt sich über den Link „Als Anki-Deck
exportieren" (`GET /api/anki/export/:skillId/:moduleId`) wieder als `.apkg` herunterladen. Der Export
schreibt bewusst das alte Anki-Schema (`ver = 11`), damit die Datei sich in jeder Anki-Version öffnen
lässt.

## Audio in einem Widget

Zwei Hooks stehen bereit und kapseln allen Gerätezugriff:

- `useMicrophone({ onBuffer })` liefert Audiopuffer und meldet Zustände `idle`, `requesting`,
  `running`, `denied`, `unsupported`, `error`. Ein Widget muss `denied` selbst darstellen — die
  restliche App darf davon nicht betroffen sein.
- `useMetronome()` liefert einen driftfreien Taktgeber mit Tap-Tempo.

Rechnende Audiologik gehört nach `packages/core/src/audio` und ist dort ohne Browser testbar.

Beispiel für das eigene Skill `skills/guitar`: `widgets/Tuner.tsx` verwendet `useMicrophone`, um
Pufferdaten an die reine Funktion `readTuning` (`@skills/core`) zu geben, und zeigt bei
`mic.state === "denied"` eine deutsche Erklärung statt eines Absturzes. `SongView.tsx` nutzt
`useMetronome` fürs Mitspielen zum Song.

## Eigene Akkord-Griffbilder

`ChordDiagramSingle` (verwendet in `SongView` und im `ChordDiagram`-Widget) zeigt zu jedem
Akkordsymbol ein Griffbild. Ein Akkordsymbol wird in dieser Reihenfolge aufgelöst:

1. Griff, den du in der Oberfläche für genau diesen Song gespeichert hast
2. Griff, den du in der Oberfläche für alle Songs gespeichert hast
3. `skills/<skill>/chords/*.json`
4. mitgelieferte offene Akkorde
5. abgeleitetes Barré-Griffbild
6. kein Griffbild — die Kachel bleibt klickbar und legt beim Bearbeiten einen neuen Griff an

Die Stufen 1 und 2 liegen in `data/app.db` und werden von der Sicherung erfasst. Der Server
schreibt nie in `chords/*.json` — diese Dateien bleiben der von Hand gepflegte Weg.

Eine `chords/*.json`-Datei ist **optional** — fehlt sie, greifen einfach die Stufen 3–5. Sie enthält
ein Array von Einträgen:

```json
[
  {
    "symbol": "Cadd9",
    "name": "Cadd9",
    "frets": [null, 3, 2, 0, 3, 0],
    "fingers": [null, 3, 2, null, 4, null],
    "baseFret": 1
  }
]
```

| Feld | Pflicht | Bedeutung |
| --- | --- | --- |
| `symbol` | ja | Das Akkordsymbol, wie es im Song vorkommt, z. B. `F`, `Bm`, `Cadd9`. |
| `name` | nein | Anzeigename über dem Griffbild. Fehlt er, wird `symbol` verwendet. |
| `frets` | ja | Genau 6 Werte, tiefe E-Saite zuerst. `null` = nicht anschlagen, `0` = leere Saite, sonst der Bund (1–24). |
| `fingers` | ja | Genau 6 Werte, gleiche Reihenfolge. `null` = keine Fingerangabe, sonst 1–4. |
| `baseFret` | ja | Bund, an dem die vier angezeigten Bundreihen beginnen (1–24). |

Eine ungültige Datei (falsche Länge, Bund außerhalb des Bereichs, fehlendes Symbol, …) wird beim
Laden übersprungen und landet als Warnung in der Konsole — genau wie bei einem fehlerhaften
Manifest stürzt die App dabei nicht ab.

`packages/web/src/music/userChords.ts` sammelt alle `chords/*.json`-Dateien über `import.meta.glob`
(wie die Registry das mit Manifesten und Modul-Daten tut), validiert sie mit `parseChordFile`
(`@skills/core`) und stellt `resolveChordShape(symbol)` bereit, das die obige Reihenfolge umsetzt.

Beispiel: `skills/guitar/chords/eigene.json` liefert einen alternativen Fingersatz für `G` und ein
zusätzliches `Cadd9`-Griffbild, das es sonst nirgends gäbe.
