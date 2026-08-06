# Skills App — Design Spec

**Datum:** 2026-08-06
**Status:** Genehmigt, bereit für Implementierungsplan

---

## 1. Zweck

Eine lokal laufende Lern-App für den täglichen Gebrauch. Zwei Startinhalte: E-Gitarre von Grund auf und Japanisch ohne Vorkenntnisse. Die App ist so gebaut, dass Agents neue Lerngebiete hinzufügen können, ohne den Kern anzufassen.

Erfolgskriterien:

- Täglich nutzbar: App öffnen, Dashboard zeigt was heute ansteht, in unter 10 Sekunden ist eine Lerneinheit gestartet.
- Ein neuer Skill entsteht durch Anlegen eines Ordners mit Manifest und Inhaltsdateien. Keine Änderung an Kerncode nötig.
- Fortschritt geht nicht verloren: eine einzelne SQLite-Datei enthält alles und lässt sich kopieren.
- Bestehende Anki-Decks (`.apkg`) lassen sich importieren und mit dem eigenen Scheduler weiterlernen.

Nicht-Ziele:

- Kein Cloud-Sync, kein Mehrbenutzerbetrieb, keine AnkiWeb-Synchronisation.
- Kein Ausliefern kommerzieller Tabulaturen oder Songtexte.
- Kein vollständiger Anki-Klon (keine Filtered Decks, kein AnkiConnect).

## 2. Entscheidungen

| Frage | Entscheidung |
| --- | --- |
| Auslieferung | Lokale Web-App, Vite-Dev-Server oder statischer Build, installierbar als PWA |
| Datenhaltung | SQLite über lokalen Node-Server |
| Anki | `.apkg`-Import in eigenes Schema, eigener FSRS-Scheduler, `.apkg`-Export |
| Sprache | Deutsche Oberfläche, deutsche Erklärungen |
| Mikrofon | Ja: Stimmgerät und Ton-Prüfung über Web Audio |
| Song-Import | Beides: Text einfügen mit Parser **und** URL vom Server abrufen |
| Skill-Modell | Hybrid: Manifest plus Inhaltsdateien als Regelfall, eigene React-Widgets als Ausweg |
| Projekt-Log | `PROJECT_LOG.md` im Repo, git-versioniert |

## 3. Architektur

### 3.1 Verzeichnisstruktur

```
skillsapp/
  server/                 Hono-API, SQLite, .apkg-Import, URL-Abruf
    src/
      db/                 Drizzle-Schema und Migrationen
      routes/             REST-Endpunkte
      services/           apkg, fetcher, backup
  web/                    React-PWA
    src/
      app/                Shell, Routing, Layout, Theme
      features/           Dashboard, Review, Statistik, Einstellungen
      skills/             Runtime: Registry, Manifest-Loader, Modul-Renderer
      ui/                 shadcn-Komponenten
  packages/core/          Gemeinsam genutzte Logik, framework-frei
    src/
      srs/                FSRS-Scheduler
      schema/             Zod-Schemas für Manifest und Inhalte
      parsers/            ChordPro, ASCII-Tab, Kana-Transliteration
  skills/
    guitar/
      skill.json
      lessons/*.mdx
      songs/*.json
      reference/*.mdx
      widgets/            Fretboard, Akkorddiagramm, Tab-Renderer, Tuner-UI
    japanese/
      skill.json
      kana/               hiragana.json, katakana.json (mit Merksätzen)
      decks/*.json        Themen-Vokabeln
      grammar/*.mdx
      reading/*.json      Sätze, Kanji, Furigana
      widgets/            Kana-Grid, Strichfolge, Furigana-Text
  data/
    app.db                SQLite, gesamter Fortschritt
    media/                Importierte Anki-Medien, Audio
  docs/superpowers/specs/
  PROJECT_LOG.md
```

Server und Web laufen als zwei Prozesse; ein `npm run dev` startet beide. Für den Alltagsbetrieb baut `npm run build` das Frontend statisch und der Server liefert es mit aus, sodass ein einziger Befehl die App startet.

### 3.2 Der Skill-Kontrakt

Ein Skill ist ein Ordner unter `skills/` mit einer `skill.json`. Die Registry im Web-Client scannt beim Start alle Manifeste (über Vites `import.meta.glob`), validiert sie gegen ein Zod-Schema und baut daraus Navigation, Dashboard-Kacheln und Routen.

```jsonc
{
  "id": "japanese",
  "name": "Japanisch",
  "icon": "languages",          // lucide-Icon-Name
  "accent": "#e05263",
  "description": "Japanisch von null bis Lesen.",
  "modules": [
    {
      "id": "kana",
      "type": "reference",       // Nachschlage-Modul
      "title": "Hiragana & Katakana",
      "pinned": true,            // erscheint als Schnellzugriff in der Kopfleiste
      "widget": "KanaGrid",      // eigenes Widget aus widgets/
      "data": ["kana/hiragana.json", "kana/katakana.json"]
    },
    {
      "id": "vocab",
      "type": "srs-deck",
      "title": "Themen-Vokabeln",
      "data": ["decks/*.json"]
    },
    {
      "id": "grammar",
      "type": "course",
      "title": "Grammatik & Sätze",
      "data": ["grammar/*.mdx"]
    },
    {
      "id": "reading",
      "type": "practice",
      "title": "Lesen",
      "widget": "ReadingTrainer",
      "data": ["reading/*.json"]
    }
  ]
}
```

**Modultypen** — der Kern kennt fünf, jeder hat einen Standard-Renderer:

| Typ | Zweck | Standard-Renderer |
| --- | --- | --- |
| `course` | Geordnete Lektionen mit Fortschritt | MDX-Lektion mit Checkpoints |
| `srs-deck` | Karten mit Wiederholungsplanung | Review-Oberfläche |
| `reference` | Nachschlagen ohne Fortschritt | Tabelle oder Raster |
| `practice` | Freies Üben, kein linearer Pfad | Widget-getrieben |
| `library` | Sammlung nutzergefüllter Objekte | Listenansicht mit Import-Knopf |

Gibt ein Modul ein `widget` an, lädt die Runtime die Komponente lazy aus dem `widgets/`-Ordner des Skills und übergibt ihr die geladenen Daten sowie eine Progress-API. Ohne `widget` greift der Standard-Renderer. Das ist der Hybrid-Ausweg: Vokabeln brauchen keinen Code, ein Griffbrett schon.

**Widget-Vertrag.** Jedes Widget ist eine React-Komponente mit der Signatur `(props: { data: unknown[]; progress: ProgressApi; settings: SkillSettings }) => JSX.Element`. `ProgressApi` bietet `record(itemId, result)`, `get(itemId)` und `complete(moduleId)`. Widgets sprechen nie direkt mit der Datenbank; sie gehen ausschließlich über diese API. Dadurch bleibt ein Widget testbar und ein Skill austauschbar.

**Warum das trägt.** Ein Agent, der ein neues Lerngebiet hinzufügt, schreibt im Normalfall nur JSON und MDX. Der Kern kennt keinen einzigen gitarren- oder japanischspezifischen Begriff. Umgekehrt kann ein Skill beliebig eigenwillig werden, ohne dass der Kern Sonderfälle sammelt.

### 3.3 Datenmodell

SQLite über Drizzle. Zentrale Tabellen:

```
skills(id, installed_at, settings_json)
modules(id, skill_id, type, title, meta_json)
notes(id, skill_id, fields_json, note_type_id, source_apkg)
note_types(id, name, fields_json, templates_json)
cards(id, skill_id, module_id, note_id, card_key, front_json, back_json, tags, state)
reviews(id, card_id, reviewed_at, rating, elapsed_ms, state_before, state_after)
scheduling(card_id PK, due, stability, difficulty, reps, lapses, state)
lesson_progress(skill_id, lesson_id, status, completed_at, checkpoint_json)
songs(id, title, artist, source_url, format, content, added_at, difficulty, tags)
media(id, filename, mime, sha256, path)
settings(key, value)
```

Die Trennung von `notes` und `cards` spiegelt Ankis Modell und ist die Voraussetzung dafür, dass importierte Decks mit mehreren Kartenvorlagen pro Notiz korrekt funktionieren. `scheduling` ist bewusst eine eigene Tabelle: der Scheduler schreibt hochfrequent, der Rest der Kartendaten ändert sich fast nie.

Die gesamte Datenbank ist eine Datei unter `data/app.db`. Backup ist ein Dateikopie-Vorgang; die App bietet zusätzlich einen Knopf, der eine datierte Kopie in `data/backups/` legt.

### 3.4 Datenfluss

Der Web-Client fragt veränderlichen Zustand per TanStack Query über die REST-API ab. Inhaltsdateien der Skills lädt er dagegen direkt — sie sind statisch und Teil des Builds. Nur Fortschritt, Karten, Songs und importierte Decks gehen über den Server.

Beim ersten Start und nach jeder Änderung an Skill-Inhalten läuft ein **Seed-Abgleich**: Die Runtime meldet dem Server die deklarierten Karten je Modul; der Server legt fehlende Karten an, markiert entfernte als `archived` und lässt bestehenden Fortschritt unangetastet. Ein Agent, der eine Vokabeldatei erweitert, verliert also nie Lernhistorie. Identität einer Karte ist der stabile Schlüssel `skill_id + module_id + card_key`, wobei `card_key` aus der Inhaltsdatei stammt und nicht aus dem Array-Index.

## 4. Komponenten

Jede Komponente ist einzeln baubar und hat eine eigene Feature-Liste. Die Reihenfolge ist Abhängigkeitsreihenfolge, keine Zeitplanung.

### C1 — Shell und Skill-Runtime

- Manifest-Loader mit Zod-Validierung; ein ungültiges Manifest blockiert nur den betroffenen Skill, nicht die App
- Registry: Skills auflisten, Module auflösen, Widgets lazy laden
- Routing: `/`, `/skill/:skillId/:moduleId`, `/review`, `/stats`, `/einstellungen`
- Layout: Seitenleiste mit Skills, Kopfleiste mit angehefteten Schnellzugriffen (`pinned: true`)
- Dark- und Light-Theme, Systemvorgabe als Standard
- Dashboard: fällige Karten je Skill, aktuelle Lektion, Streak, Tagesziel
- Tastaturkürzel: `1`–`4` Bewertung im Review, Leertaste aufdecken, `/` Suche
- PWA: Manifest, Service Worker, Offline-Fähigkeit für Shell und Inhalte

### C2 — Data Layer

- Drizzle-Schema und Migrationen für die Tabellen aus 3.3
- REST-API: Skills, Module, Karten, Reviews, Fortschritt, Songs, Einstellungen
- Seed-Abgleich mit stabilen Kartenschlüsseln und `archived`-Markierung
- Export der gesamten Datenbank als Download, Import einer Datei zurück
- Backup-Knopf, der eine datierte Kopie ablegt
- Einheitliches Fehlerformat `{ error: { code, message } }`, im Client als Toast mit Wiederholen

### C3 — SRS-Engine

- FSRS-Scheduler in `packages/core`, framework-frei und rein funktional
- Bewertungen: Nochmal, Schwer, Gut, Leicht
- Warteschlange: neue Karten, fällige Wiederholungen, Lernschritte, Tageslimits je Deck
- Vorwärtsplanung: Anzeige der nächsten Fälligkeit je Bewertung vor dem Klick
- Statistik: Heatmap, Retention, Kartenzustände, Prognose kommender Tage
- Vergraben und Aussetzen einzelner Karten
- Deterministische Scheduler-Tests gegen bekannte Eingaben

### C4 — Anki-Import

- `.apkg` entpacken (Zip), sowohl `collection.anki2` als auch `collection.anki21` unterstützen
- Notiztypen und Kartenvorlagen auslesen, Felder benennen
- Zuordnungs-Oberfläche: Quellfelder auf Vorderseite, Rückseite, Lesung und Notiz abbilden; ein Vorschlag wird automatisch geraten
- Vorschau vor dem Übernehmen: Anzahl Notizen, Karten, Medien, Beispielkarten
- Medien aus der `media`-Zuordnungsdatei nach `data/media/` schreiben, dedupliziert über SHA-256
- Import in einer Transaktion: bei Fehler bleibt die Datenbank unverändert
- Wahlweise bestehende Planungsdaten aus dem Deck übernehmen oder alles als neu behandeln
- Export eines Skill-Decks zurück nach `.apkg`
- Parser-Tests gegen mehrere echte Deck-Strukturen, darunter eines mit mehreren Kartenvorlagen pro Notiz

### C5 — Content-Renderer

- MDX-Lektionen mit eigenen Blöcken: `<Ziel>`, `<Handhaltung>`, `<Fehlerbild>`, `<Uebung>`, `<Checkpoint>`, `<Merksatz>`, `<Hinweis>`
- Lektionsfortschritt: nicht begonnen, laufend, abgeschlossen; der Checkpoint bestätigt den Abschluss
- Kursnavigation mit Voraussetzungen: eine Lektion kann eine vorherige verlangen
- Inhaltsverzeichnis und Sprungmarken
- Einbetten von Widgets in Lektionen, damit ein Griffdiagramm mitten im Text stehen kann

### C6 — Audio-Kit

- Stimmgerät: Mikrofoneingang, Tonhöhenerkennung per YIN, Anzeige in Cent, Erkennung der nächstgelegenen Saite
- Stimmungen: Standard, Drop D, Half Step Down, eigene
- Metronom mit Taktarten, Betonung, Tap-Tempo und Tempo-Steigerungsmodus
- Ton-Prüfung: der erwartete Ton wird angezeigt, die App meldet ob getroffen; Toleranz einstellbar
- Referenztöne abspielen
- Ohne Mikrofonzugriff: deutlicher Hinweis mit Erklärung, die restliche App bleibt voll nutzbar
- Latenz- und Rauschschwelle in den Einstellungen justierbar

### C7 — Guitar-Skill

Widgets:

- Griffbrett mit Notennamen, Intervallen oder Tonleitern, mehrere Bünde und Stimmungen
- Akkorddiagramm mit Fingernummern, gedämpften und leeren Saiten
- Tab-Renderer für ASCII-Tabs mit Taktstrichen und optionalem Mitlauf-Cursor

Kursaufbau, jede Lektion mit Ziel, Handanweisung, Fehlerbild, Ziel-BPM und Checkpoint:

1. Instrument und Haltung: Sitz- und Stehhaltung, Gurthöhe, Handgelenkstellung, Daumen hinter dem Hals, Finger senkrecht, Schulter locker
2. Anschlagshand: Plektrumhaltung, Ab- und Aufschlag, Abdämpfen mit Handballen und Greifhand
3. Stimmen und Saitennamen, Bundlogik, Halbton- und Ganztonschritt
4. Aufwärmen: chromatische Übungen 1-2-3-4, Fingerunabhängigkeit, Spinnen-Übung
5. Erste Töne einzeln, sauber und ohne Nebengeräusche, mit Metronom
6. Offene Akkorde: Em, Am, E, A, D, G, C, Dm
7. Akkordwechsel: gemeinsame Finger, Zielwechsel pro Minute, langsam sauber vor schnell schmutzig
8. Schlagmuster: Achtel-Grundmuster, Betonungen, konstante Anschlagbewegung
9. Power Chords und Palm Mute
10. Barré: Vorübungen, Kraft aus dem Arm statt aus dem Daumen, F- und B-Form
11. Pentatonik Box 1, Lagenwechsel, erste Licks
12. Techniken: Hammer-on, Pull-off, Slide, Bending, Vibrato
13. Theorie am Griffbrett: Notennamen, Intervalle, Tonarten, Nashville-Zahlen, Akkordfamilien einer Tonart

Weitere Module:

- Übungsplan: Zusammenstellung aus Aufwärmen, Technik, Song und Theorie mit Timer je Block
- Song-Bibliothek (siehe C8), mit Schwierigkeitsgrad und benötigten Akkorden je Song
- Rubrik "Nice to know": Saitenstärken und Materialien, Saitenwechsel, Halskrümmung und Saitenlage, Intonation, Tonabnehmertypen, Verstärker und Gain-Struktur, gängige Effekte und ihre Reihenfolge, Kabelpflege, Griffbrettpflege, Gehörschutz, Übungspsychologie und Plateaus

Ausgelieferte Songs sind Akkordfolgen sowie gemeinfreie oder eigens geschriebene Übungsriffs, gestaffelt nach benötigten Akkorden: zuerst Zwei-Akkord-Stücke (Em/Am), dann Vier-Akkord-Progressionen, dann Power-Chord-Riffs, dann Stücke mit Barré. Vollständige kommerzielle Tabulaturen und Songtexte werden nicht mitgeliefert; sie kommen über den Import des Nutzers.

### C8 — Song-Import

- Einfügen von Text: automatische Formaterkennung für ChordPro, Akkorde-über-Text und ASCII-Tabulatur
- Parser normalisiert auf ein internes Songformat mit Abschnitten, Akkorden und Taktpositionen
- URL-Abruf über den Server: HTML holen, Hauptinhalt extrahieren, an denselben Parser übergeben
- Robustheit des Abrufs: Zeitüberschreitung, Größenlimit, klare Fehlermeldung mit dem Vorschlag, den Text stattdessen einzufügen
- Sicherheit des Abrufs: nur `http` und `https`, keine privaten oder lokalen Adressen, keine Weiterleitung auf solche, kein Ausführen von Skripten aus der geholten Seite; der Abruf dient ausschließlich dem persönlichen Gebrauch des Nutzers
- Nachbearbeitung im Editor: Akkorde korrigieren, Abschnitte benennen, Kapodaster und Transponierung
- Songansicht: Transponieren, Auto-Scroll mit einstellbarem Tempo, Metronom daneben, Griffe der im Song vorkommenden Akkorde eingeblendet
- Parser-Tests gegen Beispieltexte aller drei Formate

### C9 — Japanese-Skill

**Fachliche Grundlage.** Hiragana und Katakana sind lautlich eindeutig. Kontextabhängig sind: Kanji-Lesungen (on und kun), Rendaku in Zusammensetzungen, die Partikeln は als *wa*, へ als *e* und を als *o*, das Längungszeichen ー in Katakana, kleines っ als Verdopplung des Folgekonsonanten sowie das Verstummen von Vokalen in す und し. Das Lesen bekommt deshalb ein eigenes Modul; die Kana-Module bleiben schlicht.

Module:

- **Kana-Schnellzugriff** (`reference`, angeheftet): zwei Knöpfe in der Kopfleiste, Hiragana und Katakana, jederzeit erreichbar. Raster mit allen Zeichen; ein Klick öffnet ein Detail mit Strichfolge, Merksatz, Beispielwörtern, Dakuten- und Handakuten-Varianten, Yōon-Kombinationen und den Sonderfällen (Partikeln, ー, っ, ん vor Labialen).
- **Kana lernen** (`course` plus `srs-deck`): zeilenweise Einführung mit deutschen Merksätzen zu jedem Zeichen, dazu Schreibrichtung und die typischen Verwechslungspaare (シ und ツ, ソ und ン, き und さ, ぬ und め, は und ほ). Nach jeder Zeile eine Abfrage in beide Richtungen, Zeichen zu Laut und Laut zu Zeichen.
- **Themen-Vokabeln** (`srs-deck`): Decks nach Alltagsthemen — Begrüßung und Höflichkeit, Zahlen und Zählwörter, Zeit und Datum, Essen und Restaurant, Einkaufen, Reise und Bahn, Wohnen, Familie, Arbeit und Schule, Wetter, Körper und Gesundheit, Gefühle, Hobby. Jede Karte: Japanisch, Lesung in Kana, Romaji abschaltbar, Deutsch, Beispielsatz, Tags.
- **Grammatik und Sätze** (`course`): Satzbau Subjekt-Objekt-Verb, die Partikeln は, が, を, に, で, へ, と, も, の, か, Höflichkeitsformen です und ます, Verbgruppen und Konjugation, Adjektivtypen い und な, Verneinung, Vergangenheit, て-Form und ihre Verwendungen, Zählwörter, Fragewörter, Anfänger-Keigo. Jede Einheit mit Merksatz, Gegenbeispiel und Satzbau-Übung.
- **Lesen** (`practice`, eigene Rubrik): der Kern von "lesen können".
  - Kanji-Einträge mit Bedeutung, on-Lesung, kun-Lesung, Strichzahl, Radikal, Merksatz und Beispielwörtern je Lesung
  - Regeln, wann welche Lesung greift: on-Lesung meist in Komposita aus mehreren Kanji, kun-Lesung meist allein oder mit Okurigana
  - Rendaku mit Regel und Ausnahmen, einschließlich Lymans Gesetz
  - Ganze Sätze mit umschaltbarer Furigana; ein Klick auf ein Wort zeigt Lesung, Bedeutung und die Begründung der gewählten Lesung
  - Lesetrainer: der Satz erscheint ohne Furigana, der Nutzer liest, deckt auf und bewertet sich; die Bewertung fließt in denselben SRS-Scheduler
  - Textstufen: Einzelwörter, kurze Sätze, kurze Absätze
- **Anki-Import**: importierte Decks erscheinen als eigene Module unter Japanisch und nutzen denselben Scheduler.

Merksätze sind durchgängig deutsch und bildhaft, für Kana ebenso wie für Kanji und Grammatikregeln. Wo ein Merksatz fehlt, ist das ein Mangel und wird im Projekt-Log vermerkt.

### C10 — Projekt-Log

- `PROJECT_LOG.md` im Repo-Wurzelverzeichnis, git-versioniert
- Abschnitte: Aktueller Stand je Komponente, Offene Punkte, Bekannte Probleme, Ideen und Möglichkeiten, Entscheidungsprotokoll
- Regel für Agents: nach jedem abgeschlossenen Arbeitsschritt den Stand aktualisieren und neue Erkenntnisse eintragen
- Zusätzlich `docs/skills-authoring.md`: Anleitung zum Anlegen eines neuen Skills, mit Manifest-Referenz, Modultypen, Widget-Vertrag und einem vollständigen Minimalbeispiel

## 5. Fehlerbehandlung

| Fall | Verhalten |
| --- | --- |
| API nicht erreichbar | Toast mit Wiederholen; zwischengespeicherte Daten bleiben sichtbar; Review-Bewertungen werden lokal gepuffert und nachgereicht |
| Ungültiges Skill-Manifest | Der betroffene Skill wird mit Fehlerhinweis ausgegraut, die App startet normal |
| `.apkg` fehlerhaft | Der Import bricht vor dem Schreiben ab, die Vorschau nennt die konkrete Ursache |
| URL-Abruf scheitert | Klare Meldung mit dem Vorschlag, den Text einzufügen |
| Mikrofon verweigert | Das Audio-Modul zeigt Erklärung und Anleitung, der Rest der App bleibt unberührt |
| Datenbank gesperrt oder beschädigt | Integritätsprüfung beim Start; bei Fehler Hinweis auf das jüngste Backup |

## 6. Tests

Getestet wird, wo Logik steckt:

- FSRS-Scheduler: deterministische Fälle, Zustandsübergänge, Fälligkeitsberechnung
- `.apkg`-Parser: mehrere Deck-Strukturen, darunter mehrere Kartenvorlagen pro Notiz und Medienzuordnung
- Song-Parser: ChordPro, Akkorde-über-Text, ASCII-Tabulatur
- Kana-Transliteration: Kana zu Romaji und zurück, einschließlich Yōon, Gemination, Längung und Partikel-Sonderfällen
- Seed-Abgleich: Erweitern und Entfernen von Inhalten erhält bestehenden Fortschritt
- Manifest-Validierung: gültige und ungültige Manifeste

Werkzeug ist Vitest. Dazu ein Playwright-Rauchtest über den Ablauf Dashboard öffnen, Review starten, Karte bewerten, Statistik prüfen. Einzelne Anzeige-Widgets werden nicht per Unit-Test abgedeckt.

## 7. Im Implementierungsplan zu klären

- Menge des Startinhalts je Skill: wie viele Lektionen und Karten die erste lauffähige Fassung braucht, um täglich nutzbar zu sein
- Auswahl der konkreten Übungsriffs und Akkordfolgen für die Song-Bibliothek
- Umfang der Kanji-Startmenge im Lese-Modul
