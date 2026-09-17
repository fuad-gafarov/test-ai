#!/bin/sh
# Runs automatically at container start (nginx's official image sources every
# executable *.sh file in /docker-entrypoint.d/ before starting nginx).
#
# Generates /usr/share/nginx/html/config.js from the API_BASE env var so the
# static app.js can find the backend without being rebuilt. If API_BASE is
# not set, config.js is written empty and app.js falls back to its own
# built-in default (http://localhost:8080/api/todos).
set -e

CONFIG_FILE=/usr/share/nginx/html/config.js

if [ -n "${API_BASE:-}" ]; then
  printf 'window.API_BASE = "%s";\n' "$API_BASE" > "$CONFIG_FILE"
  echo "[entrypoint] wrote $CONFIG_FILE with API_BASE=$API_BASE"
else
  printf '// API_BASE not set at container start; app.js will use its built-in default\n' > "$CONFIG_FILE"
  echo "[entrypoint] API_BASE not set; app.js default will be used"
fi
