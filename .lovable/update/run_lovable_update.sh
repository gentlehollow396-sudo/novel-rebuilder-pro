#!/usr/bin/env bash
# .lovable/update/run_lovable_update.sh
# Helper script to copy Lovable export(s) into the app update folder and run the local update command if present.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="$REPO_ROOT/.lovable/export"
APP_LOVABLE_DIR="$REPO_ROOT/lovable-app"

echo "Repo root: $REPO_ROOT"

if [ ! -d "$EXPORT_DIR" ]; then
  echo "No exports found in $EXPORT_DIR"
  exit 1
fi

mkdir -p "$APP_LOVABLE_DIR/imports"
cp -v "$EXPORT_DIR"/*.json "$APP_LOVABLE_DIR/imports/" || true

echo "Copied exports to $APP_LOVABLE_DIR/imports/"

# If there is an import script in the lovable-app, run it
if [ -x "$APP_LOVABLE_DIR/import.sh" ]; then
  echo "Found import.sh, running..."
  (cd "$APP_LOVABLE_DIR" && ./import.sh)
else
  echo "No import script found in $APP_LOVABLE_DIR. If you have a Lovable app, implement an import.sh that consumes .lovable/export/*.json or run your update pipeline manually."
fi
