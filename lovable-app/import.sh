#!/usr/bin/env bash
set -euo pipefail

# lovable-app/import.sh
# Helper to import .lovable/export/*.json into lovable-app/imports/ and optionally run an import pipeline

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
EXPORT_DIR="$REPO_ROOT/.lovable/export"
IMPORT_DIR="$(cd "$(dirname "$0")" && pwd)/imports"

echo "Repo root: $REPO_ROOT"

if [ ! -d "$EXPORT_DIR" ]; then
  echo "No exports found in $EXPORT_DIR"
  exit 1
fi

mkdir -p "$IMPORT_DIR"
cp -v "$EXPORT_DIR"/*.json "$IMPORT_DIR/" || true

echo "Copied exports to $IMPORT_DIR"

# If the lovable-app has an npm "import" script in package.json, run it
if [ -f package.json ]; then
  if grep -q '"import"' package.json; then
    echo "Found npm 'import' script in package.json — running 'npm run import'"
    npm run import || echo "npm run import failed (check logs)"
  else
    echo "No npm 'import' script found in package.json. Import files are ready in $IMPORT_DIR"
  fi
else
  echo "No package.json found in lovable-app. Import files are ready in $IMPORT_DIR"
fi
