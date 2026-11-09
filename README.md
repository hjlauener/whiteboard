# Udon Whiteboard – ILIAS 11 Repository-Plugin

Repository-Objekt-Plugin für **ILIAS 11**, mit dem sich im Magazin ein Objekt
vom Typ **„Udon Whiteboard“** hinzufügen lässt.

| | |
|---|---|
| Plugin-Name | `UdonWhiteboard` |
| Anzeigename | Udon Whiteboard |
| Plugin-ID / Objekttyp | `xudw` |
| Slot | `Services/Repository/RepositoryObject` (`robj`) |
| ILIAS | 11.0 – 11.999 |
| PHP | ≥ 8.3 |

## Lokal entwickeln und testen

Wie beim Udon Forum: Der Terminal-Befehl **`udw`** holt den neusten Stand von
GitHub und lädt das Plugin im lokalen Docker-ILIAS neu.
Einrichtung und alle Befehle: **[dev/README.md](dev/README.md)**.

Kurzfassung:

```bash
mkdir -p ~/Projekte && cd ~/Projekte
```

```bash
git clone https://github.com/hjlauener/whiteboard.git UdonWhiteboard
```

```bash
~/Projekte/UdonWhiteboard/dev/install-command.sh
```

Neues Terminal-Fenster öffnen, dann:

```bash
udw install
```

Danach genügt nach jeder Änderung:

```bash
udw
```

## Aktueller Stand

Version 0.2.0: Mehrere Personen zeichnen gleichzeitig auf demselben Board
(Formen, Pfeile, Text, Freihand, Rahmen). Änderungen der anderen erscheinen
nach etwa einer Sekunde, ihre Mauszeiger werden mit Namen angezeigt. Bilder
einfügen folgt später.

Auswählen, Verschieben, Grösse ändern, Farbe, Löschen, Rückgängig/Wiederholen,
Verbindungspfeile (wandern mit, wenn eine verbundene Form verschoben wird; den
Pfeil dazu am Rand der Form ansetzen bzw. enden lassen) und Gruppieren (Cmd+G)
kommen von Excalidraw und werden bei allen abgeglichen. Rückgängig betrifft nur
die eigenen Änderungen.

Das Board erscheint auf Deutsch, Englisch oder Französisch (je nach
ILIAS-Sprache). Neue Texte sind in der Serifenschrift Source Serif, Formen
haben saubere Linien.

Technik: PHP für die Einbindung in ILIAS, TypeScript mit
[Excalidraw](https://github.com/excalidraw/excalidraw) (MIT-Lizenz) für die
Zeichenfläche (Quellcode in `frontend/`, gebaut nach `js/dist/`).
Schrift [Source Serif 4](https://github.com/adobe-fonts/source-serif) von
Adobe (SIL Open Font License 1.1, Lizenz in `js/dist/fonts/SourceSerif/`).
