#!/usr/bin/env bash
set -euo pipefail

# Despliega a Cloudflare Pages desde un directorio curado, en vez de la raíz
# del repo. `wrangler pages deploy .` sube TODOS los archivos en disco sin
# tener en cuenta .gitignore — eso incluye config.js, default-content-prod.js
# (necesarios) pero también .dev.vars, backup/*.sql, wrangler.toml, etc.
# (nunca deben ser públicos). Este script solo copia lo que el sitio en vivo
# realmente necesita antes de pasarle ese directorio a wrangler.

cd "$(dirname "$0")"

if [ ! -f config.js ] || [ ! -f default-content-prod.js ]; then
  echo "Falta config.js y/o default-content-prod.js — revisa el README antes de desplegar." >&2
  exit 1
fi

DEPLOY_DIR="$(mktemp -d)"
trap 'rm -rf "$DEPLOY_DIR"' EXIT

for f in index.html admin.html app.jsx admin.jsx default-content.js default-content-prod.js catalog.csv config.js; do
  cp "$f" "$DEPLOY_DIR/"
done
mkdir -p "$DEPLOY_DIR/assets/images"
cp assets/images/* "$DEPLOY_DIR/assets/images/" 2>/dev/null || true
cp -r functions "$DEPLOY_DIR/functions"
find "$DEPLOY_DIR" -name ".DS_Store" -delete

npx wrangler pages deploy "$DEPLOY_DIR" "$@"
