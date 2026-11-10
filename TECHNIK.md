# Udon Whiteboard – Technik

Technische Übersicht für Entwicklerinnen und Entwickler. Bedienung und
Installation: [README.md](README.md), lokale Entwicklung:
[dev/README.md](dev/README.md).

Kurz: Auf dem Server nutzt das ILIAS-11-Plugin nur ILIAS selbst (PHP, ilDB,
RBAC, ilCtrl). Im Browser läuft [Excalidraw](https://github.com/excalidraw/excalidraw)
0.18.1 mit React 19, geschrieben in TypeScript und gebaut mit Vite. Mehrere
Personen arbeiten gleichzeitig; der Abgleich läuft per Polling über ILIAS, ohne
zusätzlichen Server.

## Aufbau

```
Browser (pro Person)                        ILIAS 11 (PHP)
┌──────────────────────────────┐           ┌─────────────────────────────────────┐
│ js/dist/whiteboard.js        │  POST     │ ilObjUdonWhiteboardGUI::syncBoard   │
│  React + Excalidraw          │  JSON     │  - Recht prüfen (udw_edit / write)  │
│  frontend/src/sync.ts ───────┼──────────▶│  - Elemente prüfen                  │
│   - eigene Änderungen senden │  1×/s     │ ilUdwRepository                     │
│   - fremde übernehmen        │◀──────────┼─  - speichern unter Tabellensperre  │
│   - Mauszeiger anzeigen      │           │  - Änderungen seit Revision n       │
└──────────────────────────────┘           │  - Anwesenheit / Mauszeiger         │
                                           └──────────────┬──────────────────────┘
                                                          │ ilDB
                                           rep_robj_xudw_board / _el / _pres
```

| Ordner | Inhalt |
|---|---|
| `classes/` | PHP: Plugin, Objekt, GUI (Seite + JSON-Endpunkt), Zugriff, Liste, Repository |
| `sql/dbupdate.php` | Tabellen (Schritt 2) |
| `lang/` | Sprachdateien de/en/fr (Plugin-Texte, auch die des Boards) |
| `frontend/` | TypeScript-Quellcode des Boards, Vite-Konfiguration, Ergänzungen der Excalidraw-Übersetzungen |
| `js/dist/` | Gebautes Board (wird eingecheckt, ILIAS braucht keinen Build) |
| `dev/` | Entwicklungsskripte (`udw`, `npm.sh`) |
| `sdk/` | Befehlssprache für KIs: Spezifikation, JSON-Schema, JS/TS- und Python-Bibliothek, MCP-Server (siehe [sdk/README.md](sdk/README.md)) |

## Eingesetzte Bibliotheken

Neben ILIAS-Standard nur im Browser bzw. zum Bauen. Alle Versionen sind in
`frontend/package.json` exakt fixiert.

| Bibliothek | Version | Lizenz | Einsatz | Wozu |
|---|---|---|---|---|
| [@excalidraw/excalidraw](https://github.com/excalidraw/excalidraw) | 0.18.1 | MIT | Laufzeit | Zeichenfläche: Formen, Pfeile mit Bindung, Text, Gruppen, Rückgängig/Wiederholen, Bild-Export; `reconcileElements` für den Abgleich |
| react, react-dom | 19.3.1 | MIT | Laufzeit | Von Excalidraw verlangt; nur für das Board |
| [Source Serif 4](https://github.com/adobe-fonts/source-serif) über `@fontsource/source-serif-4` | 5.3.1 | OFL-1.1 | Laufzeit (Schriftdateien) | Serifenschrift als Standard für Texte (latin, latin-ext, woff2) |
| vite | 8.3.7 | MIT | Build | Bündelt als ES-Modul nach `js/dist/`; zwei eigene Plugins (unten) |
| @vitejs/plugin-react | 6.3.0 | MIT | Build | JSX/React für Vite |
| typescript | 7.0.2 | Apache-2.0 | Build | Typprüfung (`tsc --noEmit` vor jedem Build) |
| @types/react, @types/react-dom | 19.3.0 | MIT | Build | Typen für React |
| @modelcontextprotocol/sdk | 1.32.2 | MIT | nur MCP-Server (gebündelt) | MCP-Protokoll für `sdk/mcp/dist/server.mjs` |
| zod | 4.6.7 | MIT | nur MCP-Server (gebündelt) | Eingaben der MCP-Werkzeuge beschreiben |
| esbuild | 0.28.2 | MIT | Build | MCP-Server zu einer Datei bündeln |
| 7 Excalidraw-Bibliotheken in 3 Sammlungen: Grundformen (Basic shapes, 3D Shapes), Figuren und Sprechblasen (Stick Figures, Stick people, Bubbles), Diagramme und Mathematik (Data Viz, Math Teacher Library) | – | MIT | Laufzeit (Daten) | Seitenleiste „Formen“; Quellen in `frontend/libraries/README.md` |
| Werners Nomenklatur der Farben | 1814/1821 | gemeinfrei (Buch); Farbwerte der Digitalisierung c82.net ohne ausdrückliche Lizenz | Laufzeit (Daten) | Palette „Ruhig und natürlich“, `frontend/palettes.ts` |

Das Board selbst und die JS/TS- und Python-Bibliothek der Befehlssprache haben
keine Abhängigkeiten; die Python-Bibliothek braucht nur die Standardbibliothek.

### Was Excalidraw mitbringt

Excalidraw zieht rund 250 Pakete nach; ins Bundle kommt nur, was importiert
wird. `js/dist/` ist etwa 7,6 MB gross (Einstieg `whiteboard.js` rund 760 kB,
gzip 230 kB); grosse Teile laden erst bei Bedarf.

- **roughjs, perfect-freehand**: Skizzen-Optik, Freihandlinien
- **jotai**: interner Zustand
- **@radix-ui** (Popover, Tabs): Menüs, Seitenleiste
- **@excalidraw/mermaid-to-excalidraw** mit mermaid, cytoscape, katex: Mermaid-Diagramme einfügen (grösster Teil, lädt nur bei Gebrauch)
- **dompurify, @braintree/sanitize-url**: Links und eingebettete Inhalte säubern
- **pica, image-blob-reduce, pako, png-chunks-\***: Bild-Export
- **fractional-indexing, nanoid**: Reihenfolge und IDs der Elemente

Gebaut werden nur die Sprachen Deutsch, Englisch, Französisch (die anderen 52
als leere Module). Die Excalidraw-Schriften liegen ohne Xiaolai (CJK, 12 MB) im
Plugin; nur für chinesische, japanische, koreanische Zeichen greift Excalidraw
auf sein CDN esm.sh zurück.

### Anpassungen im Build

Excalidraw wird nicht geforkt. Zwei Vite-Plugins in `frontend/vite.config.ts`
ändern das veröffentlichte Paket beim Bündeln; passt eine Stelle nach einem
Update nicht mehr, bricht der Build mit einer Meldung ab.

| Plugin | Was es tut |
|---|---|
| `excalidrawLocales()` | Nur de-DE, en, fr-FR bauen; Ergänzungen aus `frontend/locales/*.json` in die benannten Exporte der Sprachdatei mischen (91 fehlende Texte je Sprache; Deutsch mit „Sie“ statt „du“); Deutsch mit ss statt ß |
| `serifFont()` | Schrift „Source Serif“ (Nr. 10) in Excalidraws feste Schriftliste eintragen: Name, Metriken (Ascender 1036, Descender −335, Zeilenhöhe 1,35; im Browser gemessen), woff2-Dateien; Schriftnamen in der Auswahl ohne Anführungszeichen |

`frontend/scripts/copy-fonts.mjs` kopiert die Schriften nach `js/dist/fonts/`;
`window.EXCALIDRAW_ASSET_PATH` zeigt dorthin, damit nichts vom CDN kommt.

## Anpassungen an Excalidraw im Board

| Was | Wie |
|---|---|
| Farbpaletten | 10 Paletten in `frontend/palettes.ts` (je bis 11 Farbfamilien × 5 Abstufungen, 5 Schnellfarben für Strich und Hintergrund). Immer wählbar: Ruhig und natürlich (Werner, Standard), Modern und klar, Warm und freundlich, Spielerisch und frisch (Comic). In der Plugin-Konfiguration zuschaltbar: Pastell und sanft, Für Farbsehschwäche geeignet (Okabe-Ito), Meer und Himmel, Wald und Erde, Retro, Druckfreundlich. Alle sind im Build eingebaut (`boardDefaults()` in `vite.config.ts`); Excalidraw nimmt beim Start die Palette aus `data-config.palette`. Der Build schreibt `js/dist/palettes.json`, daraus zeigt PHP (`ilUdwPalettes`) die Farbfelder in den Formularen |
| Strichstärken | 2 / 4 / 6 statt 1 / 2 / 4 (beginnt bei der früheren mittleren), ebenfalls `boardDefaults()` |
| Schriftgrösse XXL | fünfter Knopf (48 px) nach S/M/L/XL (16/20/28/36), `hugeFontSize()` in `vite.config.ts`; in der Befehlssprache `size=XXL` |
| Eigenschaften-Leiste | 15rem statt 12,5rem breit |
| Bootstrap von ILIAS | blendet `.dropdown-menu` aus; für Excalidraws Menüs (Hamburger, „Weitere Werkzeuge“) zurückgesetzt |
| Rechtsklick | „In Rechteck/Ellipse/Raute/Notiz/Pfeil/Linie umwandeln“ (`commands/convertMenu.ts`, Befehl `convert`; Formen werden verbreitert, damit das längste Wort passt) |
| Seitenleiste „Formen“ | Dropdown mit drei Sammlungen (Grundformen; für die Lehre: Figuren und Sprechblasen, Diagramme und Mathematik), Klick fügt in der Mitte ein, Ziehen legt ab (`shapes/ShapesSidebar.tsx`) |
| Freihand glätten | fertige Freihandlinien: Ramer–Douglas–Peucker, dann Chaikin (`smoothing.ts`); im Hamburger-Menü abschaltbar |
| Füllung | Die Zeile „Füllung“ (Schraffiert, Kreuzschraffiert, Deckend) erscheint bei jeder füllbaren Form, nicht erst mit Hintergrundfarbe (`alwaysShowFill()` in `vite.config.ts`). Ohne Hintergrundfarbe setzt die Wahl einer Füllung die erste helle Hintergrundfarbe der Palette; Knopf „Füllung entfernen“ (Papierkorb) in derselben Zeile macht den Hintergrund durchsichtig (`fillMenu.ts`) |
| Vorlagen | Knopf „Vorlagen“ rechts von „KI“ (`templates/TemplatesMenu.tsx`): Themen als Untermenüs (Didaktik, Brainstorming, Organigramme, Diagramme, Mapping, Workshops, Arbeitstools), 39 Vorlagen. Liste und Reihenfolge: `frontend/templates.ts` (der Build schreibt `js/dist/templates.json` für PHP); Aufbau jeder Vorlage: `templates/catalog.ts` mit den Bausteinen aus `templates/builder.ts` (Spalten, 2×2-Matrix, Tabelle, Stern, Baum, Ablauf, Notizen). Jede Vorlage ist eine Befehlsfolge der Befehlssprache; vor dem Einfügen eine Rückfrage, dann Löschen aller Elemente und Zeichnen der Vorlage als **ein** Schritt (Rückgängig stellt das Board wieder her). Füllfarben aus der Farbpalette des Boards. Texte: Sprachdateien (`tpl_*`, `tplcat_*`, Inhalte `tplt_<Vorlage>_<Text>`; PHP liest die Inhalte aus der Sprachdatei, `ilUdwTemplates::contentTexts`). In der Plugin-Konfiguration einzeln abwählbar (`ilSetting` `xudw`/`disabled_templates`, neue Vorlagen sind eingeschaltet). Prüfung: `frontend/scripts/check-templates.ts` |
| Linienform | Knopf mit Dropdown in der Zeile „Konturstil“ (`linePatternMenu.tsx`, nur bei Linien/Pfeilen): Gerade, Zickzack, Wellenlinie, Sägezahn, Blitzlinie, Lockenlinie, Unregelmässig organisch, Zacken und Rundungen, Schlingenlinie. Das Muster wird als Punkte entlang des ursprünglichen Verlaufs berechnet (`linePatterns.ts`; Schlingen/Locken als Trochoide); der Verlauf bleibt in `customData.xudwBase`, so lässt sich die Form wechseln oder entfernen. Anfang und Ende bleiben, Pfeile bleiben verbunden; verschiebt Excalidraw ein Ende (verbundene Form bewegt), wird das Muster neu berechnet. Gilt für markierte und neue Linien (Wahl pro Browser). Befehlssprache: `pattern=…` bei `arrow`, `line`, `style` |
| Zen-Modus | nur Werkzeugleiste und „Zen-Modus verlassen“; Eintrag im Hamburger-Menü |
| KI öffnen | Dropdown: ChatGPT, Microsoft Copilot, Google Gemini im neuen Tab; Text immer in der Zwischenablage, bei ChatGPT/Copilot zusätzlich in der Adresse (`?q=`), wenn sie höchstens 8000 Zeichen lang ist |

## Befehlssprache für KIs („Udon Whiteboard Script“)

Für jede Aktion auf dem Board gibt es einen Befehl (30 Befehle: erstellen,
ändern, anordnen, Ansicht/Rückgängig), ein Befehl pro Zeile oder als JSON.
Ausgeführt wird **nur im Board** (Knopf „KI“): ein Fenster zum Einfügen,
Prüfen und Ausführen der Befehle. Der Knopf „Für eine KI kopieren“ kopiert den
Text aus `templates/ai_prompt_<de|en|fr>.txt` mit dem Board-Inhalt (aufklappbar
sichtbar); die KI fragt nach dem Wunsch, stellt Rückfragen und liefert dann das
Skript.

| Teil | Datei | Aufgabe |
|---|---|---|
| Spezifikation | `sdk/js/src/spec.ts` | Einzige Quelle: Befehle, Parameter, Farben, Beispiele (englisch, für KIs) |
| Sprachkern | `sdk/js/src/language.ts` | Zerlegen, prüfen (mit Zeilennummern), schreiben, Referenz, Prompt; Code-Blöcke aus KI-Antworten werden erkannt |
| Ausführen | `frontend/src/commands/execute.ts` | Befehle auf einer Arbeitskopie; erst wenn alle gelingen, ein einziges Update (als **ein** Schritt rückgängig zu machen); jede Änderung mit neuer Version, also normal abgeglichen |
| Exportieren | `frontend/src/commands/export.ts` | Board → Skript (Kontext für die KI; läuft auch auf einem leeren Board) |
| Overlay | `frontend/src/commands/CommandPanel.tsx` | Oberfläche; Texte aus den ILIAS-Sprachdateien |
| Bibliotheken | `sdk/` | Aus der Spezifikation erzeugt (`frontend/scripts/build-sdk.ts`) |

Umsetzung im Board: Neue Formen, Texte, Pfeile mit Beschriftung und Rahmen
erzeugt Excalidraw selbst (`convertToExcalidrawElements`), Änderungen laufen
über `newElementWith`. Pfeile werden an Formen gebunden (`startBinding`/
`endBinding`) und nach Verschieben neu geführt. Neue Texte in bestehenden
Formen lässt das Board von Excalidraw setzen (Kopie der Form mit Text
umwandeln, Text übernehmen). `undo`/`redo` lösen Excalidraws Tastenkürzel aus.

## Bewusst ohne Zusatzbibliothek

Kein WebSocket-Server, kein Yjs/CRDT, kein Composer-Paket: Das Plugin soll auf
jedem ILIAS-Hosting ohne zusätzlichen Dienst laufen.

### Abgleich (Polling)

Ein Endpunkt, `syncBoard` (POST, JSON, CSRF-Token über `ilCtrl::getFormAction`):

```
Anfrage:  {"since": 41, "elements": [ …geänderte Excalidraw-Elemente… ], "pointer": {"x": 120, "y": 80}}
Antwort:  {"rev": 44, "elements": [ …Elemente mit Revision > 41… ], "users": [{"id": 6, "name": "…", "pointer": {…}}]}
```

- **Client** (`frontend/src/sync.ts`): sendet jedes Element, dessen `version`
  höher ist als die, die der Server kennt (gesammelt, ~120 ms nach einer
  Änderung); fragt sonst jede Sekunde (versteckter Tab: alle 5 s, bei Fehlern
  mit Backoff). Fremde Elemente werden mit `reconcileElements` gemischt und mit
  `CaptureUpdateAction.NEVER` eingesetzt (Rückgängig betrifft nur eigene
  Schritte). Texte werden erst nach dem Schreiben gesendet. Offene Änderungen
  beim Schliessen: Nachfrage (`beforeunload`) und Versand per
  `navigator.sendBeacon`.
- **Laserpointer** (`frontend/src/laser.ts`): Excalidraw zeichnet die Spur
  anderer Personen Bild für Bild aus deren Zeiger (`tool: "laser"`,
  `button: "down"`). Das Board sammelt die eigenen Laserpunkte mit Zeit
  (höchstens alle 16 ms) und sendet sie beim nächsten Abgleich; solange
  jemand den Laser benutzt, fragt das Board alle 200 ms. Der Server hält die
  Punkte der letzten 3 s als nummerierte Pakete (`rep_robj_xudw_pres.laser`,
  JSON); die anderen spielen neue Pakete im ursprünglichen Takt ab (etwa
  150 ms Vorlauf, insgesamt rund eine halbe Sekunde Verzögerung).
- **Server** (`ilUdwRepository`): Schreiben unter Tabellensperre
  (`ilAtomQuery`), eine Revision pro Board; höhere `version` gewinnt, bei
  Gleichstand die kleinere `versionNonce` (wie Excalidraw). Lesen: erst die
  Revision des Boards, dann alle Elemente bis dahin; so geht keine Änderung
  verloren.
- **Prüfung** jedes Elements: ID `[A-Za-z0-9_-]{1,64}`, `version` ≥ 1, erlaubte
  Typen (keine Bilder), höchstens 1 MB pro Element, 500 pro Anfrage, 8 MB pro
  Anfrage.

### Datenbank

| Tabelle | Inhalt |
|---|---|
| `rep_robj_xudw_board` | `id` (obj_id), `rev` (Revisionszähler), `palette` (Farbpalette, Standard `natural`) |

Plugin-Konfiguration (Administration › Plugins › UdonWhiteboard › Konfigurieren, `ilUdonWhiteboardConfigGUI`): zugeschaltete Zusatzpaletten in `ilSetting` (Modul `xudw`, Schlüssel `extra_palettes`). Boards mit einer abgewählten Palette verwenden „Ruhig und natürlich“.
| `rep_robj_xudw_el` | `board_id`, `el_id`, `el_version`, `el_nonce`, `rev`, `is_deleted`, `el_json` (CLOB, Excalidraw-JSON), `last_user`, `last_update`; Index (`board_id`, `rev`) |
| `rep_robj_xudw_pres` | `board_id`, `user_id`, `pointer_x`, `pointer_y`, `last_seen` (anwesend = letzte 15 s), `laser` (Laserpunkte der letzten 3 s, JSON) |

Gelöschte Elemente bleiben als `is_deleted = 1` stehen (damit andere die
Löschung erfahren); alles wird beim endgültigen Löschen des Boards entfernt.

### Rechte (ILIAS-RBAC)

| Recht | erlaubt |
|---|---|
| `visible`, `read` | Board sehen und öffnen (Ansichtsmodus) |
| `udw_edit` „Board bearbeiten“ (eigene Operation) | zeichnen, Objekte ändern und löschen |
| `write` | Einstellungen, und ebenfalls zeichnen |

- Der Server prüft das Recht bei jeder Änderung; Anonyme nur ansehen.
- Beim ersten Installieren: Standardrechte nach dem Muster des ILIAS-Forums
  (Rollenvorlagen; „Udon Whiteboard anlegen“ überall, wo „Forum anlegen“
  erlaubt ist). Danach ändert das Plugin keine Rechte mehr von sich aus.
- In Kursen/Gruppen: „Nur Präsentation“ / „Bearbeitungsmodus für alle“ beim
  Anlegen und in den Einstellungen setzt bzw. entfernt `udw_edit` der
  Mitgliederrolle (`ilParticipants::getDefaultMemberRole`) auf diesem Board.

## Entwickeln und bauen

Node.js braucht es auf dem Mac nicht: `dev/npm.sh` startet npm im Docker-Image
von ILIAS Slim (Node 24).

```bash
./dev/npm.sh install
```

```bash
./dev/npm.sh run build
```

Danach `js/dist/` mitcommitten. `udw` (siehe `dev/README.md`) holt den Stand von
GitHub und lädt das Plugin im lokalen Docker-ILIAS neu.

Fehlersuche im Browser: in der Konsole `localStorage.xudwDebug = "1"`, Seite
neu laden, dann `window.xudw.api` (Excalidraw) und `window.xudw.sync` (Abgleich).

## Lizenzen und Hinweise

- Keine Copyleft-Lizenz im Laufzeit-Code: von rund 255 Laufzeit-Paketen 193
  MIT, 38 ISC, 10 Apache-2.0, 7 BSD-3-Clause, je einzeln 0BSD, CC0, Unlicense,
  MIT+Zlib und dompurify (MPL-2.0 oder Apache-2.0). **Offen:** fuzzy und
  khroma nennen im Lockfile keine Lizenz – vor produktivem Einsatz prüfen.
- Source Serif 4: SIL Open Font License 1.1, Lizenz in
  `js/dist/fonts/SourceSerif/LICENSE.txt`.
- Excalidraw-Update: Die Build-Plugins und `frontend/locales/*.json` greifen in
  Interna ein – nach einem Versionswechsel bauen und fehlende Übersetzungen
  erneut prüfen.
- Die KI-Funktion schickt nichts selbst an eine KI: Die Person kopiert den
  Prompt und fügt die Antwort ein. Mit dem Board-Inhalt gehen dessen Texte an
  die gewählte KI (Hinweis im Overlay).
- Last: 1 Anfrage pro Sekunde und offenem Board. Bei sehr vielen gleichzeitig
  offenen Boards ist das die Grenze, nicht die Bibliotheken.
