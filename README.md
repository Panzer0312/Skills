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
| `npm run test:e2e` | Playwright-Rauchtest |
| `npm run build` | statischer Build der Oberfläche |
| `npm run typecheck` | TypeScript über alle Pakete |

## Daten

Alles liegt in `data/app.db`. Sicherung: Datei kopieren, oder in den Einstellungen
„Sicherung anlegen" — dann landet eine datierte Kopie in `data/backups/`.

## Neuen Lernbereich hinzufügen

Siehe `docs/skills-authoring.md`. Kurzfassung: Ordner unter `skills/` anlegen, `skill.json`
schreiben, Inhaltsdateien dazulegen. Kein Eingriff in den Kern nötig.

## Projektstand

Siehe `PROJECT_LOG.md`.
