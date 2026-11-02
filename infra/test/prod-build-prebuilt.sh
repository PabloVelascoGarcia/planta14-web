#!/usr/bin/env bash
# DEPLOY_BUILD_COMMAND para ensayos en entornos donde `npm ci` no funciona dentro de `docker build`:
# compila la versión en el host (con node_modules enlazados de la copia de trabajo, misma versión de Node)
# y la empaqueta con infra/test/app-prebuilt.Dockerfile (misma base, usuario y arranque que infra/app.Dockerfile).
# Uso: prod-build-prebuilt.sh DIRECTORIO_DE_LA_VERSIÓN ETIQUETA     (PREBUILT_NODE_MODULES=ruta de node_modules)
set -Eeuo pipefail
src=$1 tag=$2
modules=${PREBUILT_NODE_MODULES:?Define PREBUILT_NODE_MODULES}
[[ -f $src/package-lock.json && -d $modules ]] || { echo "Faltan package-lock.json o node_modules" >&2; exit 1; }
cp -al "$modules" "$src/node_modules" 2>/dev/null || cp -a "$modules" "$src/node_modules"
(cd "$src" && CMS_ENABLED=false NEXT_TELEMETRY_DISABLED=1 npm run build >"$src/.build.log" 2>&1) || { tail -n 30 "$src/.build.log" >&2; exit 1; }
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
docker build -q -f "$here/app-prebuilt.Dockerfile" -t "$tag" "$src" >/dev/null
