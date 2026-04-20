#!/usr/bin/env bash
# Logs do backend Odonto (execute no servidor, na pasta do projeto).
set -euo pipefail
DIR="${ODONTO_APP_DIR:-/opt/odonto-app}"
cd "$DIR"
exec docker compose logs -f app-backend --tail "${1:-150}"
