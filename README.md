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
Technik, eingesetzte Bibliotheken und Lizenzen: **[TECHNIK.md](TECHNIK.md)**.

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

Boards und ihre Objekte werden dauerhaft in der ILIAS-Datenbank gespeichert
(jedes Objekt einzeln; Änderungen, die beim Schliessen des Tabs noch unterwegs
sind, werden noch gesendet). Die ILIAS-Rechte steuern den Zugriff:

| Recht | erlaubt |
|---|---|
| Sichtbar / Lesen | Board sehen und öffnen (nur ansehen) |
| Board bearbeiten | zeichnen, Objekte ändern und löschen |
| Bearbeiten (write) | Einstellungen, und ebenfalls zeichnen |

In Kursen und Gruppen wählt man beim Anlegen (und später in den
Einstellungen) „Nur Präsentation“ oder „Bearbeitungsmodus für alle“: Damit
wird „Board bearbeiten“ für die Mitgliederrolle dieses Boards gesetzt oder
entfernt, unabhängig von der Rollenvorlage.

Standardrechte wie beim ILIAS-Forum: Kursmitglieder dürfen zeichnen, Gäste
nur sehen; wer ein Forum anlegen darf, darf auch ein Whiteboard anlegen.

**Formen, Farben, Zeichnen:** Seitenleiste „Formen“ mit drei Excalidraw-
Bibliotheken; Farbpalette nach Werners Nomenklatur der Farben; Rechtsklick
wandelt eine Form in eine andere um; Freihandlinien werden geglättet; der
Zen-Modus zeigt nur die Werkzeugleiste.

**Befehle und KI:** Für jede Aktion gibt es einen Befehl (Udon Whiteboard
Script). Im Board öffnet der Knopf **Befehle** ein Fenster, in dem man Befehle
einfügt und ausführt, mit einer Anleitung und einem fertigen Prompt für eine
beliebige KI (ChatGPT, Claude, Copilot, Gemini …). Bibliotheken für
JavaScript/TypeScript und Python, ein MCP-Server und ein JSON-Schema liegen in
[sdk/](sdk/README.md).

Das Board erscheint auf Deutsch, Englisch oder Französisch (je nach
ILIAS-Sprache). Neue Texte sind in der Serifenschrift Source Serif, Formen
haben saubere Linien.

Technik: PHP für die Einbindung in ILIAS, TypeScript mit
[Excalidraw](https://github.com/excalidraw/excalidraw) (MIT-Lizenz) für die
Zeichenfläche (Quellcode in `frontend/`, gebaut nach `js/dist/`).
Schrift [Source Serif 4](https://github.com/adobe-fonts/source-serif) von
Adobe (SIL Open Font License 1.1, Lizenz in `js/dist/fonts/SourceSerif/`).
