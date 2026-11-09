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

Neues Terminal-Fenster öffnen, dann (sobald Plugin-Code vorhanden ist):

```bash
udw install
```

Danach genügt nach jeder Änderung:

```bash
udw
```

## Aktueller Stand

Nur die Entwicklungsumgebung ist eingerichtet – noch kein Plugin-Code.
