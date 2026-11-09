#!/usr/bin/env bash
#
# npm im Docker-Image von ILIAS Slim ausführen (dort ist Node.js installiert,
# auf dem Mac ist kein Node nötig).
#
#   ./dev/npm.sh install          Abhängigkeiten installieren
#   ./dev/npm.sh run build        Whiteboard bauen (Ergebnis in js/dist/)
#
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PLUGIN_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
IMAGE="${NODE_IMAGE:-ilias-slim-web:latest}"

docker image inspect "$IMAGE" >/dev/null 2>&1 \
    || { echo "Docker-Image '$IMAGE' nicht gefunden (NODE_IMAGE=... setzen, z.B. node:24)." >&2; exit 1; }

exec docker run --rm -t \
    -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
    -v "$PLUGIN_DIR:/plugin" -w /plugin/frontend \
    --entrypoint npm "$IMAGE" "$@"
