# Projekt-Log

Dieses Dokument ist die zentrale Stelle für Stand, Probleme und Ideen.
**Regel für Agents: nach jedem abgeschlossenen Task diesen Stand aktualisieren.**

## Stand je Komponente

| Komponente | Stand | Anmerkung |
| --- | --- | --- |
| C1 Shell und Skill-Runtime | fertig | Registry, Routing, Theme, Schnellzugriffe |
| C2 Data Layer | fertig | SQLite, Seed-Abgleich, Export und Sicherung |
| C3 SRS-Engine | fertig | FSRS-5-Gewichte, Warteschlange mit Tageslimits |
| C4 Anki-Import | offen | Plan 2 |
| C5 Content-Renderer | fertig | MDX mit Ziel, Handhaltung, Fehlerbild, Übung, Checkpoint, Merksatz, Hinweis |
| C6 Audio-Kit | offen | Plan 3 |
| C7 Guitar-Skill | offen | Plan 3 |
| C8 Song-Import | offen | Plan 3 |
| C9 Japanese-Skill | in Arbeit | Plan 2 Tasks 1-3: Kana-Transliteration (Hepburn), Kana-Daten (Hiragana/Katakana/Sonderfälle), Kana-Schnellzugriff (`KanaGrid`) und Kana-Übung (`KanaDrill`) fertig. Themen-Vokabeln, Grammatik, Lesen und Anki-Import stehen noch aus. |
| C10 Projekt-Log | fertig | dieses Dokument |

## Offene Punkte

- Anzahl der Startlektionen je Skill in der Praxis prüfen: reicht der Umfang für tägliche Nutzung?
- Die globale Suche über `/` steht in der Spec (C1), ist aber in keinem Plan umgesetzt. Bewusst
  zurückgestellt, bis genug Inhalt da ist, dass Suchen sich lohnt.

## Bekannte Probleme

- Noch keine.

## Abweichungen vom Plan (Plan 2, Tasks 1-3)

- `skills/japanese/skill.json` enthält bislang nur die Module, deren Daten existieren
  (`hiragana`, `katakana`, `sonderfaelle`, `kana-uebung`). Die Module `vokabeln`, `grammatik`
  und `lesen` aus dem Plan-Manifest kommen erst mit den zugehörigen Tasks (4+) hinzu, da
  `skills/japanese/decks/`, `grammar/` und `reading/` noch nicht existieren.
- Die Erweiterung von `packages/web/vite.config.ts` um `test.include` für `skills/**/*.test.{ts,tsx}`
  wurde bereits in Task 2 vorgenommen (nicht erst in Task 3), weil `skills/japanese/kana/kana.test.ts`
  aus Task 2 dieselbe Erweiterung braucht, um von vitest gefunden zu werden.

## Ideen und Möglichkeiten

- Export eines Skill-Decks nach `.apkg` (in Plan 2 vorgesehen).
- Tastaturkürzel `/` für eine globale Suche über alle Karten und Lektionen.

## Entscheidungsprotokoll

- 2026-08-06 — Hybrides Skill-Modell: Manifest plus Inhaltsdateien als Regelfall, eigene React-Widgets als Ausweg.
- 2026-08-06 — Tabellen per Roh-DDL statt drizzle-kit-Migrationen: eine lokale Datei, kein Team, keine Migrationshistorie nötig.
- 2026-08-06 — Kein Datenbank-Import über das Netz. Wiederherstellung läuft über den Dateiaustausch bei gestopptem Server.
