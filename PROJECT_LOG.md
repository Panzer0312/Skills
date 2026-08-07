# Projekt-Log

Dieses Dokument ist die zentrale Stelle für Stand, Probleme und Ideen.
**Regel für Agents: nach jedem abgeschlossenen Task diesen Stand aktualisieren.**

## Stand je Komponente

| Komponente | Stand | Anmerkung |
| --- | --- | --- |
| C1 Shell und Skill-Runtime | fertig | Registry, Routing, Theme, Schnellzugriffe |
| C2 Data Layer | fertig | SQLite, Seed-Abgleich, Export und Sicherung |
| C3 SRS-Engine | fertig | FSRS-5-Gewichte, Warteschlange mit Tageslimits |
| C4 Anki-Import | fertig | `.apkg`-Reader (`readApkg`) entpackt Zip, liest `collection.anki21`/`collection.anki2`, unterstützt altes (`col.models`-JSON) und neues Schema (`notetypes`/`fields`/`templates`), Medienzuordnung, klare Fehlermeldung bei zstd-komprimiertem `collection.anki21b`. Dazu `guessMapping` (Feld-Rateheuristik für Vorder-/Rückseite, Lesung, Notiz auf Deutsch und Englisch) und `importApkg`: Import von Notizen, Karten und Medien (SHA-256-dedupliziert nach `data/media/`) in **einer** Transaktion, wahlweise mit übernommenem Anki-Scheduling (`ivl`/`factor`/`due` → FSRS-Zustand) oder komplett neuem Zustand. Routen `POST /api/anki/preview` (schreibt nichts), `POST /api/anki/import` und `GET /api/anki/export/:skillId/:moduleId` (schreibt das alte Schema, `ver = 11`) unter `packages/server/src/routes/anki.ts`. Import-Oberfläche unter `/import` (`packages/web/src/features/anki/AnkiImport.tsx`): Datei wählen, Vorschau mit Feldzuordnung, Ziel wählen, importieren. Export-Link im `DeckRenderer`. |
| C5 Content-Renderer | fertig | MDX mit Ziel, Handhaltung, Fehlerbild, Übung, Checkpoint, Merksatz, Hinweis |
| C6 Audio-Kit | offen | Plan 3 |
| C7 Guitar-Skill | in Arbeit | Plan 3, Tasks 1-2: `packages/core/src/music/notes.ts` (Notennamen, Stimmungen, Griffbrett, Frequenzen, Intervalle) und `chords.ts` (Akkord-Parsing, Transponieren, Akkordtöne, offene Griffe, Barré-Formen, Stufenakkorde). Rest (Songformat, Parser, Server-Routen, Widgets, Lektionen) offen. |
| C8 Song-Import | offen | Plan 3 |
| C9 Japanese-Skill | fertig | Kana-Transliteration (Hepburn), Kana-Daten, `KanaGrid`, `KanaDrill`, acht Themen-Vokabel-Decks (256 Karten), zwölfteiliger Grammatik-Kurs, 40 Kanji mit Lesungsregeln und 60 annotierte Sätze, `ReadingTrainer`. Rauchtest in `e2e/japanese.spec.ts`. |
| C10 Projekt-Log | fertig | dieses Dokument |

## Offene Punkte

- Anzahl der Startlektionen je Skill in der Praxis prüfen: reicht der Umfang für tägliche Nutzung?
- Die globale Suche über `/` steht in der Spec (C1), ist aber in keinem Plan umgesetzt. Bewusst
  zurückgestellt, bis genug Inhalt da ist, dass Suchen sich lohnt.

## Bekannte Probleme

- `.apkg`-Dateien im neuen Format `collection.anki21b` (zstd-komprimiert) werden nicht gelesen.
  Abhilfe: in Anki mit der Option „Unterstützung für ältere Anki-Versionen" exportieren.
  Dauerhafte Lösung wäre eine zstd-Abhängigkeit im Server.

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

## Abweichungen vom Plan (Plan 2, Task 9)

- `packages/server/src/routes/anki.test.ts`: `new Blob([bytes])` mit TypeScript 5.9 ergab einen
  Typfehler (`Uint8Array<ArrayBufferLike>` nicht zuweisbar an `BlobPart`, wegen `SharedArrayBuffer`
  im Unionstyp von `ArrayBufferLike`). Behoben mit einem `as BlobPart`-Cast an der Aufrufstelle,
  Verhalten unverändert.
- Zusätzlich zum geplanten Test „archive is broken" (der nur zeigt, dass ein ungültiges Zip vor
  Transaktionsbeginn abgelehnt wird) wurde `packages/server/src/services/apkg/importDeck.test.ts`
  ergänzt: Ein Test lässt den Medien-Schreibschritt *innerhalb* der Transaktion fehlschlagen
  (Dateiname mit NUL-Byte), nachdem Notizen, Karten und Scheduling bereits eingefügt wurden, und
  prüft, dass danach `notes`, `cards`, `scheduling`, `skills` und `modules` alle leer sind. Das
  ist der eigentliche Beweis für die Rollback-Eigenschaft der SQLite-Transaktion.

## Abweichungen vom Plan (Plan 2, Tasks 10-12)

- `packages/web/src/features/anki/AnkiImport.tsx`: Die Beispielzeile in der Vorschau (`{sample.front} →
  {sample.back}`) wurde in zwei `<span>` aufgeteilt. Als reiner Text in einem `<li>` bildete Playwright
  Testing Library sonst einen einzigen Textknoten „日本 → Japan", sodass `getByText("日本")` fehlschlug.
- Der geplante Rauchtest `e2e/japanese.spec.ts` deckte einen echten Bug auf: `ModuleRoute.collect()`
  spreadet jeden array-wertigen Datei-Inhalt in Einzeleinträge (nötig, damit `ReferenceRenderer` flache
  Tabellenzeilen bekommt, z. B. für `sonderfaelle.json`). `ReadingTrainer` erwartete dagegen, dass
  `kanji.json`/`saetze.json`/`regeln.json` als ganze Arrays im `data`-Array ankommen — dadurch blieb das
  Lesetraining in der echten Anwendung leer, obwohl der isolierte Widget-Test (der `data` direkt mit
  Arrays befüllte) grün war. Fix: `ReadingTrainer` filtert jetzt den flachen `data`-Eintrag anhand von
  `kanjiEntrySchema`/`satzSchema` (aus `@skills/core`) bzw. einer Formprüfung für Regeln, statt ein
  ganzes Array zu suchen. `ReadingTrainer.test.tsx` wurde entsprechend auf ein geflachtes `data`-Array
  umgestellt, damit der Test dieselbe Form erhält wie `ModuleRoute` sie liefert. `ModuleRoute.collect()`
  selbst blieb unverändert, da andere Verbraucher (`ReferenceRenderer`, das bestehende `ModuleRoute.test.tsx`)
  auf dem Spread-Verhalten aufbauen.
- Beim Export-Routing (`packages/server/src/routes/anki.ts`) musste `writeApkg(...)` in `Buffer.from(...)`
  gewickelt werden, bevor es an `c.body(...)` geht: TypeScript lehnte den rohen `Uint8Array<ArrayBufferLike>`
  von `fflate.zipSync` ab (Hono erwartet `Uint8Array<ArrayBuffer>`). Verhalten unverändert.

## Ideen und Möglichkeiten

- Tastaturkürzel `/` für eine globale Suche über alle Karten und Lektionen.

## Entscheidungsprotokoll

- 2026-08-06 — Hybrides Skill-Modell: Manifest plus Inhaltsdateien als Regelfall, eigene React-Widgets als Ausweg.
- 2026-08-06 — Tabellen per Roh-DDL statt drizzle-kit-Migrationen: eine lokale Datei, kein Team, keine Migrationshistorie nötig.
- 2026-08-06 — Kana-Merksätze sind deutsch und bildhaft, keine Übersetzungen englischer Eselsbrücken:
  englische Merksätze funktionieren im Deutschen lautlich oft nicht.
- 2026-08-06 — Das Lese-Modul behandelt Kanji-Lesungen, Rendaku und Partikel-Sonderfälle.
  Kana selbst sind lautlich eindeutig und brauchen keine Kontextregeln.
- 2026-08-06 — Anki-Export schreibt das alte Schema (ver 11), damit jede Anki-Version die Datei öffnet.
- 2026-08-06 — Kein Datenbank-Import über das Netz. Wiederherstellung läuft über den Dateiaustausch bei gestopptem Server.
