#!/usr/bin/env bash
#
# Installiert den Terminal-Befehl "udw" (einmalig ausführen):
#
#   ./dev/install-command.sh
#
# Danach im Terminal, egal in welchem Ordner:
#   udw              neusten Stand von GitHub holen + Plugin im Docker-ILIAS neu laden
#   udw install      Plugin das erste Mal installieren
#   udw --watch      bei jeder Änderung automatisch neu laden
#   udw status       gefundenen Container anzeigen
#   udw logs | shell Container-Logs / Shell im Container
#
# Der Befehl wird nach ~/.local/bin/udw geschrieben; ~/.local/bin wird bei
# Bedarf in ~/.zshrc (und ~/.bash_profile) zum PATH hinzugefügt.

set -euo pipefail

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN_DIR="${HOME:?}/.local/bin"
CMD_NAME="udw"
CMD_PATH="$BIN_DIR/$CMD_NAME"
PATH_LINE='export PATH="$HOME/.local/bin:$PATH"'

mkdir -p "$BIN_DIR"

cat > "$CMD_PATH" <<EOF
#!/usr/bin/env bash
# UdonWhiteboard – neu laden (installiert von $REPO_DIR/dev/install-command.sh)
REPO_DIR="$REPO_DIR"
if [ ! -x "\$REPO_DIR/dev/reload.sh" ]; then
    echo "UdonWhiteboard-Repository nicht gefunden: \$REPO_DIR" >&2
    echo "Nach dem Verschieben des Ordners bitte dev/install-command.sh erneut ausführen." >&2
    exit 1
fi
if [ \$# -eq 0 ]; then
    exec "\$REPO_DIR/dev/reload.sh" --pull
fi
exec "\$REPO_DIR/dev/reload.sh" "\$@"
EOF
chmod +x "$CMD_PATH"
chmod +x "$REPO_DIR/dev/reload.sh" "$REPO_DIR/dev/UdonWhiteboard neu laden.command" 2>/dev/null || true

added=""
for rc in "$HOME/.zshrc" "$HOME/.bash_profile"; do
    # .bash_profile nur anpassen, wenn es schon existiert (macOS nutzt zsh)
    if [ "$rc" = "$HOME/.bash_profile" ] && [ ! -f "$rc" ]; then
        continue
    fi
    if ! grep -qsF '.local/bin' "$rc"; then
        printf '\n# UdonWhiteboard-Befehl "udw"\n%s\n' "$PATH_LINE" >> "$rc"
        added="$added $rc"
    fi
done

echo "✔ Befehl installiert: $CMD_PATH"
echo "  zeigt auf: $REPO_DIR"
if [ -n "$added" ]; then
    echo "✔ PATH ergänzt in:$added"
    echo
    echo "Jetzt einmal ein neues Terminal-Fenster öffnen (oder: source ~/.zshrc)."
fi
echo
echo "Danach:  udw install   (nur beim ersten Mal)"
echo "         udw           (neusten Stand holen und neu laden)"
