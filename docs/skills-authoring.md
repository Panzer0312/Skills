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

## Fortschritt und Inhaltsänderungen

Der Seed-Abgleich läuft bei jedem App-Start. Karten hinzufügen ist gefahrlos. Karten entfernen
archiviert sie, löscht sie aber nicht — kommen sie zurück, kommt der alte Lernstand mit.
