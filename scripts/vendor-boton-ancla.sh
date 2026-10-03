#!/usr/bin/env bash
# Copia versionada del botón-ancla en RUTEANDO (docs/integracion-ancla.md,
# DI-01 opción c): trae `packages/core/src` y `packages/react/src` de una
# ETIQUETA del repo boton-ancla a client/src/vendor/boton-ancla/, sin npm
# (los paquetes son privados y exportan .ts sin compilar). Next los compila
# junto con la app; los nombres @boton-ancla/core y @boton-ancla/react se
# resuelven con `paths` de client/tsconfig.json.
#
# Uso:  bash scripts/vendor-boton-ancla.sh v0.3.1
#       BOTON_ANCLA_REPO=~/boton-ancla bash scripts/vendor-boton-ancla.sh v0.3.1   (copia local)
#
# No editar a mano lo copiado: los cambios van al repo boton-ancla, con una
# etiqueta nueva, y se vuelve a correr este script.
set -euo pipefail

TAG="${1:?Falta la etiqueta, por ejemplo: v0.3.1}"
REPO="${BOTON_ANCLA_REPO:-https://github.com/melendezfer/boton-ancla.git}"
RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$RAIZ/client/src/vendor/boton-ancla"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$TAG" "$REPO" "$TMP/repo" 2>/dev/null \
  || git -c advice.detachedHead=false clone --quiet --branch "$TAG" "$REPO" "$TMP/repo"
COMMIT="$(git -C "$TMP/repo" rev-parse --short HEAD)"

rm -rf "$DEST"
mkdir -p "$DEST"
cp -r "$TMP/repo/packages/core/src" "$DEST/core"
cp -r "$TMP/repo/packages/react/src" "$DEST/react"
cp "$TMP/repo/LICENSE" "$DEST/LICENSE"
cat >"$DEST/VERSION" <<TXT
boton-ancla $TAG ($COMMIT)
Copiado con scripts/vendor-boton-ancla.sh. No editar a mano.
TXT

echo "Botón-ancla $TAG ($COMMIT) copiado en client/src/vendor/boton-ancla/"
