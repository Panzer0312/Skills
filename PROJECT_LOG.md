# Projekt-Log

Dieses Dokument ist die zentrale Stelle für Stand, Probleme und Ideen.
**Regel für Agents: nach jedem abgeschlossenen Task diesen Stand aktualisieren.**

## Stand je Komponente

| Komponente | Stand | Anmerkung |
| --- | --- | --- |
| C1 Shell und Skill-Runtime | fertig | Registry, Routing, Theme, Schnellzugriffe |
| C2 Data Layer | fertig | SQLite, Seed-Abgleich, Export und Sicherung |
| C3 SRS-Engine | fertig | FSRS-5-Gewichte, Warteschlange mit Tageslimits |
| C4 Anki-Import | in Arbeit | Plan 2 Task 8 fertig: `.apkg`-Reader (`readApkg`) entpackt Zip, liest `collection.anki21`/`collection.anki2`, unterstützt altes (`col.models`-JSON) und neues Schema (`notetypes`/`fields`/`templates`), Medienzuordnung, klare Fehlermeldung bei zstd-komprimiertem `collection.anki21b`. |
| C5 Content-Renderer | fertig | MDX mit Ziel, Handhaltung, Fehlerbild, Übung, Checkpoint, Merksatz, Hinweis |
| C6 Audio-Kit | offen | Plan 3 |
| C7 Guitar-Skill | offen | Plan 3 |
| C8 Song-Import | offen | Plan 3 |
| C9 Japanese-Skill | in Arbeit | Plan 2 Tasks 1-7 fertig: Kana-Transliteration (Hepburn), Kana-Daten, `KanaGrid`, `KanaDrill`, acht Themen-Vokabel-Decks (256 Karten), zwölfteiliger Grammatik-Kurs, 40 Kanji mit Lesungsregeln und 60 annotierte Sätze, `ReadingTrainer`. Nur der Anki-Import (Tasks 8+) steht noch aus. |
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

## Abweichungen vom Plan (Plan 2, Tasks 4-7)

- `packages/web/src/renderers/CourseRenderer.tsx` und `packages/web/src/skills/ModuleRoute.tsx`
  wurden generalisiert: Der MDX-Lektions-Glob war fest auf den Ordnernamen `lessons/*.mdx`
  verdrahtet (funktionierte nur für den Demo-Skill). Da Plan 2 den Grammatik-Kurs unter
  `skills/japanese/grammar/*.mdx` vorsieht, liest `CourseRenderer` den Ordnernamen jetzt aus
  einer `folder`-Prop, die `ModuleRoute` aus dem ersten `data`-Eintrag des Moduls ableitet
  (`"grammar/*.mdx"` → `"grammar"`, Default bleibt `"lessons"`). Ohne diese Änderung wäre das
  `grammatik`-Modul in der Oberfläche leer geblieben, obwohl seine Tests grün sind.
- Die 40-Kanji-Liste aus dem Plantext ergibt bei genauer Zählung nur 37 eindeutige Zeichen
  (日 kommt in der Aufzählung doppelt vor). Da der Test exakt 40 Einträge verlangt, wurden drei
  zusätzliche, ebenso gebräuchliche Anfänger-Kanji ergänzt: 女, 子, 見.
- Reading-Regeln, Kanji und Sätze folgen den Mustern aus dem Plan; die Absatz-Ebene in
  `saetze.json` verwendet ausschließlich Kanji aus `kanji.json` (auch Wochentagsnamen mit 曜
  wurden dafür vermieden, da 曜 nicht in der Liste steht).

## Ideen und Möglichkeiten

- Export eines Skill-Decks nach `.apkg` (in Plan 2 vorgesehen).
- Tastaturkürzel `/` für eine globale Suche über alle Karten und Lektionen.

## Entscheidungsprotokoll

- 2026-08-06 — Hybrides Skill-Modell: Manifest plus Inhaltsdateien als Regelfall, eigene React-Widgets als Ausweg.
- 2026-08-06 — Tabellen per Roh-DDL statt drizzle-kit-Migrationen: eine lokale Datei, kein Team, keine Migrationshistorie nötig.
- 2026-08-06 — Kein Datenbank-Import über das Netz. Wiederherstellung läuft über den Dateiaustausch bei gestopptem Server.
