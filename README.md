# Skills

Lokale Lern-App mit erweiterbaren Lernbereichen.

## Starten

```bash
npm install
npm run dev
```

Oberfläche: http://localhost:5173 — Server: http://localhost:5174

## Befehle

| Befehl | Wirkung |
| --- | --- |
| `npm run dev` | Server und Oberfläche gleichzeitig |
| `npm test` | Unit-Tests |
| `npm run dev:lan` | wie `dev`, aber im Heimnetz erreichbar (zum Üben am Handy); die App hat keine Anmeldung, also nur im eigenen Heimnetz nutzen und mit Strg+C beenden |
| `npm run test:e2e` | Playwright-Rauchtest |
| `npm run build` | statischer Build der Oberfläche |
| `npm run typecheck` | TypeScript über alle Pakete |

## Daten

Alles liegt in `data/app.db`. Sicherung: Datei kopieren, oder in den Einstellungen
„Sicherung anlegen" — dann landet eine datierte Kopie in `data/backups/`.

Eigene Songs liegen ebenfalls in `data/app.db`. Der URL-Abruf ist ein Werkzeug für den persönlichen
Gebrauch: er holt eine einzelne Seite, prüft die Adresse gegen private Netze und wertet nur Text aus.

## Mitgelieferte Lernbereiche

`skills/demo` (Vorlage und alle Modultypen), `skills/japanese` (30-Lektionen-Kurs, Kana, Vokabeln,
Grammatik, Lesen) und `skills/guitar`. Die Gitarre ist ein kleines Rollenspiel: Nach einer kurzen
Einstufung beim ersten Start führt ein Dorf zu Quest Board (Tagesquests nach Sitzungslänge),
Bibliothek (27 Lektionen), Karte (Hafen: 85 Lektionen auf sieben Pfaden, die übrigen als „in Vorbereitung“), Taverne (Songbibliothek mit Import), Schrein (Stimmgerät), Schmiede
(Akkordgriffe) und Griffbrett. Geübte Minuten und ehrliche Bewertungen bringen XP, Level und eine
Serie; es gibt keine Strafen. Der Akkordwechsel-Trainer zählt eine Minute lang saubere Wechsel.
Nichts ist gesperrt, alle Werkzeuge sind jederzeit erreichbar. Griffbilder lassen sich direkt im
Song ändern — wahlweise nur für diesen Song oder für alle.

## Neuen Lernbereich hinzufügen

Siehe `docs/skills-authoring.md`. Kurzfassung: Ordner unter `skills/` anlegen, `skill.json`
schreiben, Inhaltsdateien dazulegen. Kein Eingriff in den Kern nötig.

## Projektstand

Siehe `PROJECT_LOG.md`.
