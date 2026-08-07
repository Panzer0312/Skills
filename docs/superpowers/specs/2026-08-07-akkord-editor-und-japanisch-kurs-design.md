# Akkord-Editor im Song und Japanisch-Anfängerkurs

Datum: 2026-08-07

Zwei unabhängige Vorhaben in einem Dokument, weil sie zusammen beauftragt wurden. Sie teilen
keinen Code und können in beliebiger Reihenfolge umgesetzt werden.

- **Teil A** — Akkordgriffe direkt im Song bearbeiten oder neu anlegen, wahlweise nur für diesen
  Song oder für alle Songs.
- **Teil B** — ein vollständiger Anfängerkurs im Skill „Japanisch", 30 Lektionen.

---

## Teil A — Akkordgriffe im Song bearbeiten

### Ausgangslage

`resolveChordShape(symbol)` in `packages/web/src/music/userChords.ts` löst ein Akkordsymbol in
dieser Reihenfolge auf:

1. `skills/*/chords/*.json` (per `import.meta.glob`, zur Buildzeit eingelesen)
2. `OPEN_CHORDS` aus `@skills/core`
3. abgeleitetes Barré-Griffbild
4. `null` — die Anzeige meldet dann „Für diesen Akkord ist kein Griffbild hinterlegt."

Die JSON-Dateien sind nur über den Dateisystem-Zugriff des Nutzers änderbar, nicht aus der
Oberfläche heraus, und kennen keinen Song-Bezug.

### Ziel

Aus der Song-Ansicht heraus lässt sich jedes Griffbild bearbeiten oder ein fehlendes neu anlegen.
Beim Speichern entscheidet der Nutzer zwischen zwei Geltungsbereichen:

- **nur dieser Song** — der Griff gilt ausschließlich beim Öffnen genau dieses Songs.
- **alle Songs** — der Griff gilt überall, wo das Symbol vorkommt.

### Datenmodell

Neue Tabelle, angelegt per Roh-DDL in `packages/server/src/db/client.ts` (analog zu allen
bestehenden Tabellen — siehe Entscheidungsprotokoll vom 2026-08-06) und als Drizzle-Tabelle in
`packages/server/src/db/schema.ts` gespiegelt:

```sql
CREATE TABLE IF NOT EXISTS chord_overrides (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  scope TEXT NOT NULL,
  song_key TEXT NOT NULL DEFAULT '',
  symbol TEXT NOT NULL,
  name TEXT,
  frets_json TEXT NOT NULL,
  fingers_json TEXT NOT NULL,
  base_fret INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS chord_overrides_identity
  ON chord_overrides (scope, song_key, symbol);
```

`scope` ist `"global"` oder `"song"`. Bei `scope = "global"` ist `song_key` der leere String, nicht
`NULL` — SQLite behandelt `NULL`-Werte in einem Unique-Index als untereinander verschieden, ein
`NULL` würde den Index für globale Einträge also wirkungslos machen.

`frets_json` und `fingers_json` sind JSON-Arrays der Länge 6 in genau der Form, die
`chordFileEntrySchema` in `packages/core/src/schema/content.ts` bereits beschreibt (Bünde `null`
oder 0–24, Finger `null` oder 1–4, `baseFret` 1–24). Es entsteht kein zweites Schema.

### Song-Schlüssel

Songs kommen aus zwei Quellen mit unterschiedlichen Kennungen. Der Schlüssel vereinheitlicht sie:

| Quelle | Schlüssel |
| --- | --- |
| mitgeliefertes Übungsstück (`skills/guitar/songs/uebungsstuecke.json`) | `uebung:<id>` |
| importierter Song (Tabelle `songs`) | `song:<id>` |

`SongView` bekommt eine neue **optionale** Prop `songKey?: string`. `SongLibrary` reicht sie beim
Öffnen durch. Die Vorschau in `SongImport` hat noch keinen gespeicherten Song und übergibt sie
nicht — dort bietet der Editor nur „alle Songs" an und blendet die Song-Option aus.

### Auflösungsreihenfolge

`resolveChordShape` wird zu einer Funktion mit explizit übergebenen Overrides:

```ts
resolveChordShape(symbol: string, overrides?: ChordOverrides): ChordShape | null
```

mit `ChordOverrides = { song?: Record<string, ChordShape>; global?: Record<string, ChordShape> }`.
Neue Reihenfolge:

1. Song-Override (`overrides.song`)
2. globaler Override (`overrides.global`)
3. `skills/*/chords/*.json`
4. `OPEN_CHORDS`
5. abgeleitetes Barré-Griffbild
6. `null`

Ohne `overrides` verhält sich die Funktion exakt wie bisher; alle bestehenden Aufrufer und Tests
bleiben gültig. Die Reihenfolge aus `docs/skills-authoring.md` bleibt bestehen, die zwei neuen
Ebenen schieben sich davor. `docs/skills-authoring.md` wird entsprechend ergänzt.

Die Funktion bleibt rein: sie führt keine Netzabfrage aus. Das Laden übernimmt der Aufrufer.

### API

Neue Route-Datei `packages/server/src/routes/chords.ts`, in `createApp` registriert.

| Route | Wirkung |
| --- | --- |
| `GET /api/chords` | `{ global: Entry[], song: [] }` |
| `GET /api/chords?songKey=song:3` | `{ global: Entry[], song: Entry[] }` — nur Einträge dieses Songs |
| `GET /api/chords?all=1` | `{ entries: Entry[] }` — alle Einträge inklusive `scope` und `songKey`, für die zentrale Verwaltung |
| `PUT /api/chords` | Upsert eines Eintrags |
| `DELETE /api/chords?scope=…&symbol=…[&songKey=…]` | Löscht genau einen Eintrag |

`PUT`-Body:

```json
{ "scope": "song", "songKey": "song:3", "symbol": "F#m",
  "name": "F#m (leichter)", "frets": [2,4,4,2,2,2], "fingers": [1,3,4,1,1,1], "baseFret": 1 }
```

Validierung mit Zod: `scope` als Enum, `songKey` Pflicht wenn `scope = "song"` und dann nicht leer,
verboten wenn `scope = "global"`; der Griff selbst über das vorhandene `chordFileEntrySchema`.
Fehler antworten im etablierten Format `{ error: { code, message } }` mit Status 400.

`DELETE` auf einen nicht existierenden Eintrag antwortet `{ ok: true }` — löschen ist idempotent,
wie schon bei `DELETE /api/songs/:id`.

Der API-Client (`packages/web/src/api/client.ts`) hat bisher nur `get`/`post`/`put`. Er bekommt ein
`del<T>(path)`.

Die Einträge liegen in `data/app.db` und sind damit automatisch von „Sicherung anlegen" erfasst.

### Editor-Komponente

Neu: `packages/web/src/music/ChordEditor.tsx` — eine reine Formularkomponente ohne API-Wissen.

```ts
interface ChordEditorProps {
  symbol: string;
  initial: ChordShape | null;   // null = leeres Raster für einen neuen Griff
  allowSongScope: boolean;      // false in der Import-Vorschau
  onSave: (shape: ChordShape, scope: "song" | "global") => void;
  onReset?: (scope: "song" | "global") => void;
  onCancel: () => void;
}
```

Bedienung:

- Raster 6 Saiten × 5 Bünde. Klick auf eine Zelle setzt einen Punkt, erneuter Klick entfernt ihn.
  Pro Saite ist höchstens ein Punkt gesetzt.
- Kopfzeile pro Saite schaltet durch leer (`0`) → gedämpft (`x`) → zurück, solange kein Punkt
  gesetzt ist. Ein gesetzter Punkt überschreibt beides.
- Fingerauswahl 1–4 je gesetztem Punkt, Zahlenfeld für den Startbund (1–24).
- Live-Vorschau über dasselbe `ChordDiagramSingle`, damit Editor und Anzeige nie auseinanderlaufen.
- Speichern-Zeile mit zwei Schaltflächen: „Nur in diesem Song" und „In allen Songs"; die erste
  fehlt, wenn `allowSongScope` falsch ist. Dazu „Zurücksetzen", das den Override der jeweiligen
  Ebene löscht, sodass wieder die darunterliegende Ebene greift.

Die Komponente ist ohne Server testbar: Eingaben rein, `onSave`-Aufruf raus.

### Einstiegspunkte

**Inline im Song.** `ChordDiagramSingle` bekommt eine optionale Prop `onEdit?: () => void`; ist sie
gesetzt, wird die Kachel zu einer Schaltfläche mit sichtbarem Bearbeiten-Hinweis. `SongView` lädt
per React Query `["chords", songKey]` die Overrides, reicht sie an `resolveChordShape` durch,
öffnet bei Klick den `ChordEditor` in einem Dialog und schreibt beim Speichern über die API zurück
(danach `invalidateQueries`).

Damit auch Akkorde bearbeitbar sind, für die es noch kein Griffbild gibt, bleibt die Kachel mit dem
Text „kein Griffbild hinterlegt" klickbar und öffnet den Editor mit leerem Raster.

**Zentral im Modul „Akkordgriffe".** `skills/guitar/widgets/ChordDiagram.tsx` bekommt zwei Reiter:

- „Offene Akkorde" — die heutige Ansicht.
- „Eigene Griffe" — Liste aller Overrides mit Symbol, Ebene (global oder Songtitel), Bearbeiten und
  Löschen; dazu „Neuer Akkord" mit freiem Symbolfeld. Für Song-Einträge wird der Titel über die
  Songliste aufgelöst; ein Eintrag zu einem gelöschten Song zeigt den rohen Schlüssel und lässt
  sich löschen.

Die Übersicht lädt einmalig `GET /api/chords?all=1` und muss damit nicht pro Song abfragen.

### Tests

- `packages/core` — keine Änderung nötig, `chordFileEntrySchema` ist bereits getestet.
- `packages/server/src/routes/chords.test.ts` — Upsert überschreibt statt zu duplizieren, Song- und
  Global-Eintrag zum selben Symbol koexistieren, ungültiger Griff wird mit 400 abgewiesen,
  `scope: "song"` ohne `songKey` wird abgewiesen, Löschen ist idempotent.
- `packages/web/src/music/userChords.test.ts` — Vorrang Song > global > Datei > `OPEN_CHORDS` >
  Barré; ohne `overrides` unverändertes Verhalten.
- `packages/web/src/music/ChordEditor.test.tsx` — Klick setzt und entfernt Punkte, `x`/`0` schalten
  durch, `onSave` liefert die erwartete Form und den gewählten Geltungsbereich, ohne
  `allowSongScope` fehlt die Song-Schaltfläche.
- `packages/web/src/features/songs/SongView.test.tsx` — ein Song-Override verdrängt das
  mitgelieferte Griffbild in der Anzeige.
- `e2e/guitar.spec.ts` — Song öffnen, Griffbild bearbeiten, „Nur in diesem Song" speichern, geänderte
  Darstellung prüfen.

---

## Teil B — Japanisch-Anfängerkurs

### Ziel

Ein durchgehender Weg vom ersten Kana bis zu einfachen Alltagsgesprächen, als eigenes Modul neben
den bestehenden Modulen. Kein Ersatz für „Grammatik & Sätze": der Kurs ist der rote Faden, das
Grammatikmodul bleibt Nachschlagewerk. Kurslektionen verweisen im Fließtext auf die passende
Grammatik- oder Kana-Seite, statt Inhalte zu duplizieren.

### Aufbau

Neues Verzeichnis `skills/japanese/lessons/` mit 30 MDX-Dateien, benannt `01-…mdx` bis `30-…mdx`.
Jede Datei beginnt wie im Gitarrenkurs mit

```js
export const meta = { id: "01-aussprache", title: "Aussprache", order: 1, requires: null };
```

und kettet `requires` lückenlos auf die jeweils vorige Lektion.

Neues Modul in `skills/japanese/skill.json`, als erstes Modul eingefügt:

```json
{ "id": "kurs", "type": "course", "title": "Kurs",
  "subtitle": "30 Lektionen, aufeinander aufbauend", "data": ["lessons/*.mdx"] }
```

| Block | Lektionen | Inhalt |
| --- | --- | --- |
| Schrift | 1–7 | Aussprache und Mora, Hiragana a–na, Hiragana ha–n, Dakuten/Handakuten, Yōon, kleines っ und lange Vokale, Katakana |
| Erste Sätze | 8–12 | Satzbau und です, は gegen が, を/に/で, の und Zugehörigkeit, Fragen mit か |
| Verben | 13–18 | Verbgruppen, ます-Form, Verneinung, Vergangenheit, て-Form, Verlaufsform ている |
| Adjektive und Zahlen | 19–23 | い-Adjektive, な-Adjektive, Vergleich und Steigerung, Zahlen, Zählwörter |
| Alltag | 24–30 | Zeitangaben und Termine, Wegbeschreibung, Einkaufen, Essen und Bestellen, Bitten und Erlauben (てください / てもいい), Wollen und Können (たい / できる), Höflichkeitsebenen mit Abschlusstest |

### Bausteine

Der Kurs nutzt ausschließlich die bestehenden MDX-Komponenten aus
`packages/web/src/mdx/components.tsx`: `Ziel`, `Merksatz`, `Fehlerbild`, `Uebung`, `Hinweis`,
`Checkpoint`. `Handhaltung` bleibt gitarrenspezifisch und kommt hier nicht vor; `Uebung` wird ohne
`bpm` verwendet. Es entsteht kein neuer Baustein.

Pflichtblöcke je Lektion: `<Ziel>`, `<Fehlerbild>`, `<Uebung>` mit Lösungen im selben Block,
`<Checkpoint>`. `<Merksatz>` und `<Hinweis>` nach Bedarf.

Sprachliche Vorgaben, aus dem Entscheidungsprotokoll übernommen: Erklärungen auf Deutsch,
Merksätze bildhaft und deutsch gedacht statt aus dem Englischen übersetzt. Japanische Beispiele in
Kana (ab Block 3 mit den bis dahin eingeführten Kanji), jeweils mit deutscher Übersetzung.

### Tests

Neu: `skills/japanese/lessons/lessons.test.ts`, aufgebaut wie
`skills/guitar/lessons/lessons.test.ts`:

- genau 30 MDX-Dateien
- `order` lückenlos 1–30, erste Lektion `requires: null`, jede weitere verweist auf die vorige
- jede Datei enthält `<Ziel>`, `<Fehlerbild>`, `<Uebung`, `<Checkpoint>`
- `id` im `meta` stimmt mit dem Dateinamen ohne Endung überein

Die Registry braucht keinen neuen Test: das Modul nutzt das Wildcard-Muster `lessons/*.mdx`, das
`getBrokenSkills()` bereits behandelt und das — anders als ein nicht-Wildcard-Eintrag auf eine
`.mdx`-Datei — keinen „fehlt"-Fehler auslösen kann. Nach der Umsetzung wird trotzdem einmal
`getBrokenSkills()` über alle Skills laufen gelassen, um genau das zu belegen.

### Dokumentation

`README.md` nennt für `skills/japanese` künftig auch den Kurs. `PROJECT_LOG.md` erhält nach der
Umsetzung die üblichen Abschnitte zu Abweichungen und Entscheidungen.

---

## Was ausdrücklich nicht dazugehört

- Kein Schreiben in `skills/*/chords/*.json` durch den Server. Die Dateien bleiben der von Hand
  gepflegte Weg; die Oberfläche schreibt ausschließlich in die Datenbank.
- Kein Export der eigenen Griffe als JSON-Datei. Sicherung läuft über die Datenbanksicherung.
- Kein Audio, keine Strichfolgen-Animationen und keine Handschrifterkennung im Japanisch-Kurs.
- Keine neuen SRS-Decks für den Kurs; die bestehenden Themen-Decks bleiben unverändert.
