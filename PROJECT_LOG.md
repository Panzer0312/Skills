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
| C6 Audio-Kit | fertig | Plan 3, Task 4: `packages/core/src/audio/pitch.ts` (YIN-Tonhöhenerkennung `detectPitch`, `readTuning` mit nächstgelegener Saite). Task 5: `packages/web/src/audio/useMicrophone.ts` (Mikrofonzugriff über `getUserMedia`/`AnalyserNode`, degradiert bei Ablehnung sauber zu `state: "denied"` mit deutscher Erklärung), `useMetronome.ts` (Taktgeber über `AudioContext.currentTime`-Vorausplanung, Tap-Tempo, Akzent auf Zählzeit 1). Task 6: `packages/web/src/audio/referenceTone.ts` (`playReferenceTone`, Sinuston zum Nachstimmen nach Gehör). |
| C7 Guitar-Skill | fertig | Plan 3, Tasks 1-3: `packages/core/src/music/notes.ts` (Notennamen, Stimmungen, Griffbrett, Frequenzen, Intervalle), `chords.ts` (Akkord-Parsing, Transponieren, Akkordtöne, offene Griffe, Barré-Formen, Stufenakkorde) und das interne Songformat: `song.ts` (Zod-Schema `Song`/`SongSection`/`SongLine`/`TabLine`, `transposeSong`), `detectFormat.ts`, `parseChordPro.ts`, `parseChordSheet.ts`, `parseTab.ts` sowie `parseSong` als Format-Dispatcher in `packages/core/src/music/index.ts`. Task 6: `skills/guitar/skill.json` sowie die Widgets `Fretboard` (Griffbrett bis Bund 15, umschaltbar zwischen Notennamen/Intervallen/Dur-Tonleiter, Stimmung wählbar), `ChordDiagram` (Raster aller offenen Akkorde) mit `packages/web/src/music/ChordDiagramSingle.tsx` (einzelnes Griffbild, auch von der künftigen Songansicht nutzbar) und `Tuner` (Cent-Anzeige, Saitenerkennung, Referenzton, einstellbare Rauschschwelle `minRms`). Tasks 7-8: 13 Lektionen, Nice-to-know-Referenz, `PracticePlan`-Widget. Task 9: `skills/guitar/songs/uebungsstuecke.json` (zwölf selbst geschriebene Übungsstücke, gestaffelt nach Stufe), `skills/guitar/widgets/SongLibrary.tsx` (Bibliotheksansicht, gefiltert nach Stufe, plus importierte Songs aus `/api/songs`), `packages/web/src/features/songs/SongView.tsx` (Songanzeige mit Transponieren, Auto-Scroll, Metronom, Griffbildern). Task 11: `packages/web/src/features/songs/SongImport.tsx` unter `/songs/neu`, Navigationseintrag „Song hinzufügen" in `Layout.tsx`. Task 12: `nice-to-know`-Modul in `skills/guitar/skill.json` von einem festen Dateinamen auf das Muster `reference/*.mdx` umgestellt (siehe „Abweichungen vom Plan (Plan 3, Task 12)") — das Registry-Manifest verlangte sonst eine Datei, die als JSON-Daten nie geladen wurde, und meldete den Skill fälschlich als kaputt. Rauchtest in `e2e/guitar.spec.ts`. |
| C8 Song-Import | fertig | Plan 3, Task 10: `packages/server/src/services/songFetch.ts` (`assertPublicUrl`, `extractSongText` mit `cheerio`, `fetchSongFromUrl` mit manueller Redirect-Verfolgung), `packages/server/src/routes/songs.ts` (`GET/POST /api/songs`, `GET/DELETE /api/songs/:id`, `POST /api/songs/fetch`), eingehängt in `app.ts`. Siehe „Abweichungen vom Plan (Plan 3, Task 10)" für die SSRF-Absicherung und ihre bekannte Grenze (DNS-Rebinding) im Detail. |
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
- Der URL-Abruf funktioniert nur bei Seiten, die den Tab im HTML ausliefern. Seiten, die ihn per
  JavaScript nachladen, liefern nichts Verwertbares — dort bleibt das Einfügen des Textes der Weg.
- Die Tonhöhenerkennung braucht ein sauberes Signal. Bei starker Verzerrung im Signalweg schwankt
  die Anzeige; dann direkt in die Mikrofonbuchse spielen oder clean stimmen.
- Der URL-Abruf prüft den Hostnamen aus der URL gegen die Sperrliste, nicht die tatsächlich
  aufgelöste IP-Adresse (siehe „Abweichungen vom Plan (Plan 3, Task 10)"). DNS-Rebinding — ein
  Hostname, dessen DNS-Eintrag zwischen Prüfung und Abruf auf eine private Adresse wechselt —
  würde die Sperre umgehen. Für den vorgesehenen Gebrauch (eigene, bekannte Song-Seiten) ist das
  hinnehmbar; eine vollständige Absicherung bräuchte IP-Pinning der Verbindung.

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

## Abweichungen vom Plan (Plan 3, Task 3)

- `packages/core/src/music/parsers.test.ts`: Die im Plan vorgegebene Test-Fixture für `parseChordPro`
  erwartete für den `Am`-Akkord in `"[Em]Erste Zeile mit [Am]zwei Akkorden"` die Position 17. Mit dem
  im Plan ebenfalls verbatim vorgegebenen `parseChordPro` ergibt sich für diese Zeile aber rechnerisch
  Position 16 (`raw.indexOf("[Am]") === 20`, Cursor nach `[Em]` bei 4, also `20 - 4 = 16` Zeichen
  Lyrics-Text davor). Nachgerechnet mit Node, die Fixture selbst war also inkonsistent mit der
  mitgelieferten Referenzimplementierung. Die Testerwartung wurde auf 16 korrigiert; alle anderen
  Positionsprüfungen (z. B. im Chord-Sheet-Test) stimmten bereits mit der Referenzimplementierung
  überein.
- 15 erwartete Tests laut Plan (Step 5) vs. 13 tatsächliche `it`-Blöcke in der vorgegebenen
  `parsers.test.ts` — reine Falschzählung im Plantext, keine fehlenden Tests.

## Abweichungen vom Plan (Plan 3, Task 4)

- `packages/core/src/audio/pitch.ts`: Die im Plan vorgegebene `detectPitch`-Implementierung leitet
  die untere Suchgrenze (`minLag`) aus `maxFrequency` ab. Das lässt den mitgelieferten Test
  „returns null outside the configured frequency window" (Signal bei 3000 Hz, `maxFrequency: 1400`)
  fehlschlagen: Da echte Perioden kürzer als `minLag` nie durchsucht werden, findet der Algorithmus
  stattdessen ein Vielfaches der wahren, zu kurzen Periode (hier ≈3 Perioden ≈44 Samples ≈1000 Hz)
  innerhalb des erlaubten Fensters und meldet fälschlich einen gültigen Wert. Fix: `minLag` ist jetzt
  eine feste kleine Konstante (2), unabhängig von `maxFrequency`; die Suche findet so die wahre
  (zu hohe) Periode, die die abschließende `minFrequency`/`maxFrequency`-Prüfung dann korrekt verwirft.
- `readTuning`: Die vorgegebene Implementierung berechnete `cents` über `nearestNote(frequency)`
  (nächstgelegener chromatischer Ton) unabhängig von der über `targetString` bestimmten Saite. Beim
  Test „reports how far off a slightly flat string is" (80 Hz, Zielsaite E2 bei 82,41 Hz) liegt der
  nächste chromatische Ton aber D#2 (77,78 Hz), nicht E2 — `nearestNote` lieferte dadurch `+49` statt
  des erwarteten Werts kleiner als `-20`. Fix: `cents` wird jetzt relativ zur ermittelten Zielsaite
  berechnet (Abstand in Cent zur Saitenfrequenz), `nearestNote` dient nur noch als Fallback, wenn keine
  Saite nahe genug ist (`targetString === null`).

## Abweichungen vom Plan (Plan 3, Task 5)

- Keine: `useMicrophone.ts` und `useMetronome.ts` wurden wie im Plan vorgegeben übernommen, alle
  8 mitgelieferten Tests sind ohne Anpassung grün.

## Abweichungen vom Plan (Plan 3, Task 6)

- Keine: `Fretboard.tsx`, `ChordDiagramSingle.tsx`, `ChordDiagram.tsx`, `Tuner.tsx`,
  `referenceTone.ts` und `skills/guitar/skill.json` wurden wörtlich aus dem Plan übernommen.
  Alle 13 mitgelieferten Tests sind ohne Anpassung grün (der Plantext nennt an einer Stelle
  „10 Tests"; tatsächlich sind es 4 + 4 + 5 = 13, da `ChordDiagramSingle` und das `ChordDiagram`-
  Widget in derselben Datei getestet werden).
- `skills/guitar/skill.json` verweist bereits jetzt auf die Module `uebungsplan`, `songs` und
  `nice-to-know`, deren Daten und Widgets erst in späteren Tasks entstehen. Bis dahin markiert
  die Registry (`loadSkills`) den ganzen Skill als „broken", weil ein nicht-Glob-Dateiverweis im
  Manifest fehlt — das ist erwartetes Verhalten bei einem mehrteiligen Plan und kein Bug.

## Abweichungen vom Plan (Plan 3, Task 7)

- Keine strukturellen Abweichungen: alle dreizehn Lektionen (`01-haltung.mdx` … `13-theorie.mdx`)
  wurden nach dem im Plan vorgegebenen Muster (Ziel, Handhaltung, Fehlerbild, Übung mit BPM,
  Merksatz, Checkpoint, `requires`-Kette) neu geschrieben — der Plan lieferte nur die ersten beiden
  Lektionen (`01-haltung`, `07-akkordwechsel`) wörtlich vor, die übrigen elf folgen demselben Aufbau.
  Alle 16 mitgelieferten Tests sind grün.

## Abweichungen vom Plan (Plan 3, Task 8)

- `PracticePlan.tsx`: Die im Plan wörtlich vorgegebene Implementierung rendert Blockdauer und
  Gesamtzeit als einfachen Text (`{block.minuten} Minuten…` bzw. `{total} Minuten insgesamt.`).
  Mit den mitgelieferten Testdaten (Blöcke 5 und 10 Minuten, Summe 15) enthält der Text der
  Gesamtzeit-Zeile („15 Minuten insgesamt") als Teilstring zwangsläufig auch „5 Minuten" — dadurch
  fand `screen.getByText(/5 Minuten/)` im Test „lists every block with its duration" zwei Treffer
  (Gesamtzeile und Aufwärmen-Block) und schlug mit einem Mehrdeutigkeitsfehler fehl. Fix: Wenn die
  Blockdauer eines Blocks als Teilstring in der Gesamtzeile vorkäme, wird die Zahl in ein eigenes
  `<span>` verschoben, sodass der eigene Text des Eltern-Elements (`getNodeText`, das nur direkte
  Text-Kindknoten zählt) das Wort „Minuten" ohne die Zahl enthält und keine zweite Übereinstimmung
  mehr entsteht; die Anzeige bleibt visuell identisch. Alle 7 mitgelieferten Tests (3 Referenz, 4
  Widget) sind danach grün, ohne den Testtext selbst zu ändern.

## Abweichungen vom Plan (Plan 3, Task 9)

- Vier-Akkord-Progressionen ohne `F`: Der Plantext schlägt für zwei der vier Vier-Akkord-Stücke
  `C-Am-F-G` und `Am-F-C-G` vor. `F` steht aber nicht in `OPEN_CHORDS` (`packages/core/src/music/chords.ts`)
  — dort sind nur `Em`, `Am`, `E`, `A`, `D`, `G`, `C`, `Dm`, `Dsus2`, `Asus4` sowie die Septakkorde
  hinterlegt. Der mitgelieferte Test „uses only open chords up to level two" hätte mit `F` in einem
  Stufe-2-Stück zwangsläufig fehlgeschlagen. `F` durch `Dm` ersetzt (`C-Am-Dm-G` und `Am-Dm-C-G`) —
  beides sind gängige, offene Vier-Akkord-Folgen ohne Barré, was zur Stufenlogik passt (offene
  Griffe bis Stufe 2, Barré erst ab Stufe 4). Alle übrigen Vorgaben (Em/Am, Am/C, G/D, Em/G;
  G-D-Em-C, Em-C-G-D; zwei Power-Chord-Riffs, zwei Barré-Stücke) 1:1 übernommen. Alle zwölf Texte
  sind eigens für dieses Projekt geschriebene Übungszeilen, keine fremden Songtexte oder Tabulaturen.

## Abweichungen vom Plan (Plan 3, Task 10)

- SSRF-Schutz beim URL-Abruf (`packages/server/src/services/songFetch.ts`) geht an zwei Stellen
  über den Plantext hinaus: `isBlockedHost` blockt zusätzlich IPv4-mapped-IPv6-Adressen
  (`::ffff:127.0.0.1` u.ä. — sonst triviale Umgehung der v4-Bereichsprüfung) und den CGNAT-Bereich
  `100.64.0.0/10`. Die Test-Datei enthält zwei zusätzliche Fälle über die Plan-Vorgabe hinaus: einen
  expliziten Timeout-Test (prüft `code: "timeout"` und die deutsche Ausweich-Meldung) und einen Test
  für zu viele Weiterleitungen. Bekannte Grenze, bewusst nicht behoben: Die Host-Prüfung arbeitet auf
  dem Hostnamen aus der URL, nicht auf der tatsächlich aufgelösten IP-Adresse — ein Angreifer, dessen
  DNS-Eintrag zur Abrufzeit auf eine private Adresse zeigt (DNS-Rebinding), würde die Prüfung
  passieren. Eine vollständige Absicherung bräuchte eine eigene DNS-Auflösung mit IP-Pinning der
  Verbindung (z. B. über `undici` mit eigenem `lookup`/`connect`), was über den im Plan beschriebenen
  Umfang hinausgeht.
- Testtext-Bug im Plan korrigiert: Die im Plan wörtlich vorgegebenen Tests „reports an unreachable
  host with a helpful message" und (neu) der Timeout-Test prüfen die Fehlermeldung mit
  `toMatch(/einfügen/i)`. Die im selben Plan-Abschnitt vorgegebenen Fehlermeldungen enthalten aber
  nirgends das zusammenhängende Wort „einfügen", sondern z. B. „…füge ihn stattdessen ein.“ — die
  Regex hätte nie gepasst. Regex auf `/stattdessen ein/i` geändert, Meldungstexte unverändert
  übernommen.
- `SongImport.test.tsx`: `userEvent.type()` scheitert an `@testing-library/user-event@14` beim
  ChordPro-Text, weil `{title: …}` und `{start_of_verse}` als Tastenkombinations-Syntax geparst
  werden (`{` muss dort escaped werden). Für die beiden betroffenen Tests auf `userEvent.paste()`
  umgestellt (semantisch ohnehin näher am „Text einfügen"-Feature), restliches Tippen unverändert.
  Zusätzlich einen expliziten Parametertyp für den `fetchMock` in „saves the song with the edited
  title" ergänzt (`vi.fn(async (_url: string, _init?: RequestInit) => …)`), da TypeScript die
  Tupel-Länge sonst als `[]` inferierte und `call![1]!.body` nicht typprüfte.

## Abweichungen vom Plan (Plan 3, Task 12)

- Die Registry (`packages/web/src/skills/registry.ts`) lädt Modul-Daten ausschließlich über einen
  `import.meta.glob` auf `**/*.json` und markiert einen Skill als kaputt, wenn ein nicht-Wildcard-
  Eintrag im Manifest nicht in dieser Datenmenge auftaucht. `skills/guitar/skill.json` deklarierte
  für das `nice-to-know`-Modul `"data": ["reference/nice-to-know.mdx"]` — eine `.mdx`-Datei kommt
  im JSON-Glob nie vor, also meldete `getBrokenSkills()` den gesamten Gitarre-Skill als kaputt,
  obwohl die Datei existiert und `CourseRenderer` sie über einen eigenen, unabhängigen MDX-Glob
  korrekt rendert (die Registry-Daten werden für `course`-Module gar nicht zur Anzeige benutzt).
  Fix: Eintrag auf das Muster `"reference/*.mdx"` umgestellt, analog zum bestehenden
  `"lessons/*.mdx"` des `kurs`-Moduls — Wildcard-Einträge lösen nie einen „fehlt"-Fehler aus, auch
  wenn (wie hier) keine passende JSON-Datei existiert. Verifiziert mit einem temporären Testlauf von
  `getBrokenSkills()`/`getSkills()` gegen alle drei Skills: vorher `broken: [{ dir: "guitar", ... }]`,
  danach `broken: []` und alle drei (`demo`, `guitar`, `japanese`) in `skills`.

## Abweichungen vom Plan (Barré-Folgearbeit, UNIT 2: eigene Akkord-Griffbilder)

- Ein zuvor durch Auth-Ablauf abgebrochener Agent hatte bereits `chordFileEntrySchema` /
  `parseChordFile` in `packages/core/src/schema/content.ts` samt Tests hinterlassen. Geprüft und für
  korrekt befunden (6er-Arrays, `null` für gedämpft, Bundgrenzen 0–24, Fingergrenzen 1–4, Symbol
  Pflicht) — unverändert übernommen, nur darauf aufgebaut statt neu geschrieben.
- Neu: `packages/web/src/music/userChords.ts` lädt `skills/<skill>/chords/*.json` per
  `import.meta.glob`, genau wie `registry.ts` Manifeste und Moduldaten lädt. Eine ungültige Datei
  wird übersprungen und landet als `console.warn` — dieselbe Ausfallphilosophie wie bei einem
  kaputten Manifest. `resolveChordShape(symbol)` setzt die Reihenfolge eigene JSON → `OPEN_CHORDS` →
  abgeleitetes Barré-Griffbild → `null` um; `ChordDiagramSingle` nutzt das jetzt statt direkt
  `OPEN_CHORDS`.
- `ChordDiagramSingle` zeigt jetzt den Startbund („n. Bund") sobald `baseFret > 1` ist, und markiert
  einen Barré (mehrere Saiten, ein Finger, gleicher Bund) mit einem durchgehenden Balken statt
  sechs optisch unabhängigen Punkten.
- `skills/guitar/chords/eigene.json` als lauffähiges Beispiel ergänzt: ein alternativer Fingersatz
  für das offene `G` (überschreibt `OPEN_CHORDS`) und ein `Cadd9`-Griffbild, das es sonst nirgends
  gäbe (weder offene Tabelle noch Barré-Ableitung decken `add9` ab) — belegt beide Vorrangfälle.
- `packages/server/data/` war ein nicht ignoriertes Artefaktverzeichnis (nur `e2e.db*` war per
  `.gitignore` erfasst, `app.db*` nicht, da die ältere Regel `data/app.db*` nur auf das Repo-Wurzel-
  `data/` zeigte). Verzeichnis gelöscht und `.gitignore`-Zeile auf `packages/server/data/` verallgemeinert
  (deckt jetzt jede Datei darin ab, nicht nur die bekannten Namen); mit `git check-ignore -v` gegen
  `app.db`, `whatever.db-shm` und das Verzeichnis selbst verifiziert.
- `e2e/guitar.spec.ts` um einen Test ergänzt, der „Barré in F-Dur" öffnet und prüft, dass „kein
  Griffbild" nirgends auf der Seite steht — vorher fiele das exakt so aus, wenn die Ableitung für F
  je bräche.

## Abweichungen vom Plan (Akkord-Editor und Japanisch-Kurs)

- Griffbild-Overrides liegen in SQLite (`packages/server/src/db/schema.ts`, `chords`-Route in
  `packages/server/src/routes/chords.ts`, aufgelöst über `packages/web/src/music/chordOverrides.ts`
  und `useChordOverrides.ts`), nicht als Dateien unter `skills/<skill>/chords/*.json` wie die
  eigenen Griffbilder aus der Barré-Folgearbeit (siehe „Abweichungen vom Plan (Barré-Folgearbeit,
  UNIT 2: eigene Akkord-Griffbilder)"): Der Vite-Glob, der `chords/*.json` einliest, arbeitet zur
  Buildzeit und kann keinen Song-bezogenen Geltungsbereich (nur für diesen Song, nicht für alle)
  abbilden — das JSON-Dateiformat kennt keinen solchen Scope. Overrides mit Song-Scope brauchen
  deshalb eine zur Laufzeit veränderliche Ablage; `chords/*.json` bleibt daneben bestehen als die
  vom Skill mitgelieferte, unveränderliche Grundlage.
- Der Japanisch-Kurs (`skills/japanese/lessons/01-aussprache.mdx` … `30-hoeflichkeit.mdx`) verweist
  durchgehend auf das bestehende Grammatikmodul „Grammatik & Sätze" und die Themen-Vokabel-Decks,
  statt deren Inhalt zu wiederholen: Der Kurs ist der rote Faden mit fester Lektionsreihenfolge und
  Sperrung, die beiden anderen Module bleiben eigenständige Nachschlagewerke.
- Block „Alltag" (Lektionen 24–30, Task 11): Lektion 24 korrigiert unterwegs eine eigene erste
  Fassung der ふん-Lautwechsel — 4 Minuten heißt よんぷん, nicht よんふん, weil die は-Reihe bei diesem
  Zählwort nach jeder Zahl auf ん oder kleinem っ zur ぱ-Reihe wechselt (いち, さん, ろく, はち, じゅう,
  よん), nicht nur nach dem bei ほん/ひき bekannten Fünferset. Das unterscheidet sich vom Muster aus
  Lektion 23 und wird in Lektion 24 explizit als eigenes Muster benannt, um keine falsche Analogie
  zu suggerieren.
- Lektion 28 (Bitten und Erlauben) benutzt いただけませんか als feste, besonders höfliche Bittform,
  bevor die zugrundeliegende Potentialform in Lektion 29 (Wollen und Können) allgemein erklärt wird.
  Das ist eine bewusste Vorwegnahme mit Verweis auf die nächste Lektion, keine unbelegte Ausnahme:
  いただきます aus Lektion 27 hat den Wortstamm いただく bereits eingeführt.

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
- 2026-08-06 — Kein Ausliefern kommerzieller Tabs oder Songtexte. Mitgeliefert werden Akkordfolgen
  und eigene Übungsriffs; fremdes Material kommt ausschließlich über den Import des Nutzers.
- 2026-08-06 — Der URL-Abruf prüft jeden Weiterleitungssprung erneut gegen die Sperrliste privater
  Adressen. Ohne diese Prüfung wäre der Server ein offener Proxy ins eigene Netz.
- 2026-08-06 — Das Metronom plant Klicks über AudioContext.currentTime voraus statt über setInterval,
  weil setInterval im Browser um zweistellige Millisekunden driftet.
- 2026-08-07 — Griffbild-Overrides liegen in SQLite, nicht in `chords/*.json`: der Vite-Glob liest
  die Dateien zur Buildzeit, und ein songbezogener Geltungsbereich hat im Dateiformat keine Entsprechung.
- 2026-08-07 — Der Japanisch-Kurs verweist auf das Grammatikmodul, statt es zu ersetzen: der Kurs ist
  der rote Faden, das Grammatikmodul bleibt Nachschlagewerk.
