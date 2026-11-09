# UdonWhiteboard – Projektregeln

ILIAS Repository-Objekt-Plugin (Name `UdonWhiteboard`, Anzeigename
„Udon Whiteboard“, ID `xudw`). Ziel-Version: ILIAS 11 (lokale Testumgebung des
Auftraggebers: ILIAS 11 / ILIAS Slim in Docker, dasselbe wie beim Udon Forum).
Aufbau und Arbeitsweise wie beim Udon Forum (`hjlauener/forum`) und beim
Gruppenmanagement-Plugin. GitHub: `hjlauener/whiteboard`.

## Stand

Version 0.3: gemeinsames Whiteboard (Excalidraw) im Reiter „Inhalt“,
Abgleich per Polling, Mauszeiger der anderen, dauerhaft in der Datenbank
gespeichert; ILIAS-Rechte steuern Sehen und Bearbeiten; Reiter „Info“,
„Einstellungen“ (Titel, Beschreibung) und „Rechte“. Noch keine Bilder.

## Aufbau

- **PHP (`classes/`)**: ILIAS-Einbindung, Rechte, Speichern.
  `ilObjUdonWhiteboardGUI::syncBoard` ist der Endpunkt des Boards (POST, JSON),
  `ilUdwRepository` speichert die Elemente (eine Zeile pro Excalidraw-Element,
  Revision pro Board, Schreiben unter Tabellensperre; höhere Version gewinnt,
  bei gleicher Version die kleinere `versionNonce`).
- **TypeScript (`frontend/`)**: React + Excalidraw, gebaut mit Vite nach
  `js/dist/` (wird committet, damit `udw` ohne Node funktioniert).
  `src/sync.ts` = Abgleich mit dem Server.
- Bauen (Node läuft im Docker-Image von ILIAS Slim, auf dem Mac nicht nötig):

  ```bash
  ./dev/npm.sh install
  ./dev/npm.sh run build
  ```

- **Nach jeder Änderung in `frontend/` neu bauen und `js/dist/` mitcommitten.**
- `TECHNIK.md` (Bibliotheken, Versionen, Lizenzen, Abgleich, Datenbank,
  Rechte) bei jeder Änderung daran nachführen.
- Texte des Boards kommen aus den ILIAS-Sprachdateien (über `data-config`),
  nicht fest in TypeScript; die Excalidraw-Oberfläche hat eigene Übersetzungen.
- Sprachen des Boards: nur Deutsch, Englisch, Französisch (je nach
  ILIAS-Sprache, sonst Englisch). `frontend/locales/de-DE.json` und
  `fr-FR.json` ergänzen Excalidraws Übersetzungen (fehlende Texte, Deutsch mit
  „Sie“); der Build fügt sie ein und schreibt Deutsch mit ss statt ß. Neue
  Excalidraw-Version: fehlende Texte erneut prüfen.
- Standard für neue Elemente: Serifenschrift „Source Serif“ (Source Serif 4,
  OFL, aus `@fontsource/source-serif-4`), saubere Linien (jede Person kann es
  im Board ändern). Die Schrift wird im Build in Excalidraws feste
  Schriftliste eingefügt (`serifFont()` in `vite.config.ts`, Nummer 10,
  Metriken im Browser gemessen); bei einer neuen Excalidraw-Version bricht
  der Build ab, falls die Stellen nicht mehr passen.
- Abgleich: Texte erst senden, wenn sie fertig geschrieben sind (leere Texte
  würden von anderen Boards entfernt); gleiche Version mit anderer
  `versionNonce` wird abgeglichen (kleinere gewinnt, wie auf dem Server).
- Fehlersuche im Browser: `localStorage.xudwDebug = "1"`, neu laden, dann
  `window.xudw.api` / `window.xudw.sync` in der Konsole. Menü ohne Links zu Excalidraw und ohne „Zeichenfläche
  löschen“ (würde das Board für alle leeren).

## Sprachdateien

- **Jeder neue oder geänderte Text kommt immer in alle drei Dateien:**
  `lang/ilias_de.lang`, `lang/ilias_en.lang` und `lang/ilias_fr.lang`. Die
  Schlüssel aller Dateien müssen identisch sein (gleiche Reihenfolge).
- Deutsch ohne englische Begriffe, Schweizer Schreibweise (ss statt ß).
  („Whiteboard“ als Name des Objekts ist erlaubt.)
- Kein Text fest im PHP-Code; Plugin-Texte über `$this->txt("key")`.
- Die Dateien sind in Abschnitte gegliedert (`# --- Abschnitt ---`; Zeilen mit
  `#` am Anfang ignoriert ILIAS). Neue Schlüssel in den passenden Abschnitt,
  in allen Dateien an derselben Stelle. Deutsch mit „Sie“, Englisch britisch,
  Französisch mit „vous“, geschütztes Leerzeichen (U+00A0) vor : ? ! und
  innerhalb « ».

Prüfen:

```bash
diff <(cut -d'#' -f1 lang/ilias_de.lang) <(cut -d'#' -f1 lang/ilias_en.lang)
diff <(cut -d'#' -f1 lang/ilias_de.lang) <(cut -d'#' -f1 lang/ilias_fr.lang)
```

## Rechte

- `visible`/`read`: Board sehen und öffnen (Ansichtsmodus), `udw_edit`
  („Board bearbeiten“, eigene RBAC-Operation): zeichnen und Objekte
  bearbeiten, `write`: Einstellungen und ebenfalls bearbeiten. Der Server
  prüft das Recht bei jeder Änderung (`syncBoard`); Anonyme nur ansehen.
- In Kursen/Gruppen: Auswahl „Nur Präsentation“ / „Bearbeitungsmodus für
  alle“ beim Anlegen und in den Einstellungen (dort nur mit
  `edit_permission`); setzt/entfernt `udw_edit` der Mitgliederrolle
  (`ilParticipants::getDefaultMemberRole`) auf diesem Board.
- Beim ersten Installieren setzt das Plugin Standardrechte nach dem Muster
  des ILIAS-Forums (`ensureDefaultPermissions()`): Rollenvorlagen und
  „Udon Whiteboard anlegen“ überall, wo „Forum anlegen“ erlaubt ist. Danach
  ändert es nichts mehr an Rechten (Einstellungen der Administration bleiben).

## Oberfläche

- Rückfragen (z.B. Löschen) als Overlay wie im ILIAS-Kern (Interruptive Modal),
  keine eigenen Bestätigungsseiten.
- Nur UI-Aufrufe verwenden, die in ILIAS 11 funktionieren
  (z.B. kein `$f->legacy(...)` mit alter Signatur).

## Datenbank

- Neue DB-Schritte in `sql/dbupdate.php` anhängen und die Version in
  `plugin.php` erhöhen, sonst führt ILIAS sie nicht aus.
- Tabellen mit Präfix `rep_robj_xudw_`.
- Spaltennamen nicht aus der Liste reservierter Wörter (z.B. `status`).

## Entwickeln / Testen

- Der Auftraggeber testet mit `udw` (holt den Branch und lädt das Plugin im
  lokalen Docker-ILIAS neu), siehe `dev/README.md`.
- Vor jedem Push: `php -l` auf alle PHP-Dateien (z.B. im Container:
  `docker exec -i ilias-slim-ilias-1 php -l < datei.php`), den
  Sprachdatei-Check oben und `./dev/npm.sh run build` (prüft auch die Typen).
