#!/usr/bin/env bash
# Despliegue de una versión concreta (etiqueta o commit) de Planta 14 en el servidor de producción.
#
# Uso (como el usuario administrador, desde la copia del repositorio en el servidor, p. ej. /srv/planta14/app):
#   infra/deploy/deploy.sh --env-file infra/.env.production v2.0.0
#   infra/deploy/deploy.sh --env-file infra/.env.production 1a2b3c4d
#
# Pasos:
#   1. Resuelve la versión a un commit y construye su imagen en el servidor (infra/app.Dockerfile de esa versión).
#   2. Copia de PostgreSQL ANTES de migrar (infra/backup/backup-postgres.sh). Sin copia no se migra.
#   3. Migra con el usuario migrador, arranca la nueva versión y espera a que /api/health diga "ok".
#   4. Si algo falla, vuelve AUTOMÁTICAMENTE a la versión anterior. Solo si la migración llegó a aplicar cambios,
#      restaura la copia del paso 2 en una base nueva y la pone en servicio; la base con los cambios se conserva
#      renombrada (planta14_fallida_<fecha>) para analizarla.
# Las herramientas de despliegue (este script, Compose y Caddy) son las de la copia del servidor; la aplicación
# es la de la versión pedida. Estado en DEPLOY_STATE_DIR (versión actual, anterior e historial).
#
# Código de salida: 0 desplegada; 1 falló y se volvió a la anterior (web funcionando); 2 falló y NO se pudo
# volver (requiere intervención); 3 no se cambió nada (error previo).
set -Eeuo pipefail
SCRIPT_NAME=deploy
here=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
infra=$(cd "$here/.." && pwd)
repo=$(cd "$infra/.." && pwd)
# shellcheck source=SCRIPTDIR/../lib/common.sh
source "$infra/lib/common.sh"
# shellcheck source=SCRIPTDIR/lib.sh
source "$here/lib.sh"

env_file=$infra/.env.production
while [[ $# -gt 0 ]]; do
  case $1 in
    --env-file) env_file=${2:?}; shift 2 ;;
    -h|--help) sed -n '2,22p' "$0"; exit 0 ;;
    -*) die "Opción no reconocida: $1" ;;
    *) break ;;
  esac
done
[[ $# -eq 1 ]] || die "Uso: $0 [--env-file F] VERSIÓN (etiqueta o commit)"
ref=$1
trap 'log "ERROR inesperado en la línea $LINENO"; exit 3' ERR
deploy_init "$env_file"
exec 8>"$DEPLOY_STATE_DIR/.deploy.lock"
flock -n 8 || { log "Ya hay un despliegue en curso"; exit 3; }

# --- 1. Versión e imagen ---------------------------------------------------------------------------
if [[ ${DEPLOY_NO_FETCH:-0} != 1 ]]; then git -C "$repo" fetch --quiet --tags origin || log "AVISO: no se pudo actualizar desde origin; se usa lo local"; fi
sha=$(git -C "$repo" rev-parse --verify --quiet "$ref^{commit}") || { log "No existe la versión $ref"; exit 3; }
tag=$(image_tag "$sha")
previous=$(state_get current)
log "Versión pedida: $ref ($sha). Actual: ${previous:-ninguna}"
if [[ $sha == "$previous" && ${DEPLOY_FORCE:-0} != 1 ]]; then log "Esa versión ya está desplegada (DEPLOY_FORCE=1 para repetir)"; exit 0; fi
if docker image inspect "$tag" >/dev/null 2>&1; then log "Imagen $tag ya construida"
else
  build=$(mktemp -d); trap 'rm -rf -- "$build"' EXIT
  git -C "$repo" archive "$sha" | tar -x -C "$build"
  [[ -f $build/infra/app.Dockerfile ]] || { log "La versión $ref no tiene infra/app.Dockerfile"; exit 3; }
  log "Construyendo $tag (puede tardar varios minutos)"
  if [[ -n ${DEPLOY_BUILD_COMMAND:-} ]]; then "$DEPLOY_BUILD_COMMAND" "$build" "$tag"
  else docker build --pull=false -f "$build/infra/app.Dockerfile" -t "$tag" --label "org.planta14.commit=$sha" "$build"; fi || { log "Falló la construcción; no se ha cambiado nada"; exit 3; }
fi

# --- 2. Base de datos en marcha y copia previa -----------------------------------------------------
compose up -d postgres >/dev/null
wait_postgres || { log "PostgreSQL no responde; no se ha cambiado nada"; exit 3; }
before=$(applied_migrations)
dump=''
if [[ -n $(sql_super "SELECT 1 FROM pg_tables WHERE schemaname = 'public' LIMIT 1") ]]; then
  log "Copia de seguridad previa a la migración"
  dump=$("$infra/backup/backup-postgres.sh" --env-file "$env_file") || { log "Falló la copia previa; no se migra ni se cambia nada"; exit 3; }
  log "Copia previa: $dump"
else log "Base vacía (primera instalación): no hay nada que copiar"; fi

rollback() { # MOTIVO
  log "FALLO: $1"
  local after; after=$(applied_migrations || true)
  local changed_data=0; [[ $after != "$before" ]] && changed_data=1
  if [[ -z $previous ]]; then
    compose stop app >/dev/null 2>&1 || true
    record "fallo-sin-anterior $sha"
    notify "FALLO en el primer despliegue de $ref" "No hay versión anterior a la que volver. La web está parada. Motivo: $1"
    exit 2
  fi
  log "Volviendo a la versión anterior ${previous:0:12}"
  compose stop app >/dev/null 2>&1 || true
  if (( changed_data )); then
    [[ -n $dump ]] || { notify "FALLO grave en el despliegue de $ref" "La migración cambió datos y no hay copia previa."; exit 2; }
    log "La migración llegó a aplicar cambios: se restaura la copia previa"
    restore_dump "$dump" || { notify "FALLO grave en el despliegue de $ref" "No se pudo restaurar la copia previa $dump. La web está parada."; exit 2; }
  else
    log "La migración no cambió datos: no hace falta restaurar"
  fi
  if APP_IMAGE=$(image_tag "$previous") compose up -d app caddy >/dev/null && wait_healthy; then
    record "vuelta-atras $sha -> $previous (restauracion=$changed_data)"
    notify "Despliegue de $ref fallido; vuelta atrás correcta" "Motivo: $1. La web sigue con la versión ${previous:0:12}. Restauración de datos: $([[ $changed_data == 1 ]] && echo sí || echo no)."
    log "La web funciona con la versión anterior ${previous:0:12}"
    exit 1
  fi
  notify "FALLO grave: la versión anterior tampoco responde" "Tras fallar $ref, la versión ${previous:0:12} no pasa /api/health."
  exit 2
}
trap 'rollback "error inesperado en la línea $LINENO"' ERR

# --- 3. Migración, arranque y comprobación ---------------------------------------------------------
log "Migrando con el usuario de migraciones"
if ! APP_IMAGE=$tag compose --profile migrate run --rm -T migrate > "$DEPLOY_STATE_DIR/last-migrate.log" 2>&1; then
  tail -n 15 "$DEPLOY_STATE_DIR/last-migrate.log" | sed 's/^/    /' >&2
  rollback "la migración falló"
fi
after=$(applied_migrations)
if [[ $after == "$before" ]]; then log "Sin migraciones nuevas"; else log "Migraciones aplicadas: $(comm -13 <(echo "$before") <(echo "$after") | tr '\n' ' ')"; fi
log "Arrancando $tag"
APP_IMAGE=$tag compose up -d app caddy >/dev/null || rollback "no arrancó"
wait_healthy || rollback "/api/health no responde \"ok\" en ${DEPLOY_HEALTH_TIMEOUT:-180} s"

# --- 4. Hecho --------------------------------------------------------------------------------------
trap - ERR
state_set previous "$previous"
state_set current "$sha"
record "desplegada $sha ($ref)"
prune_images "$sha" "$previous"
log "Desplegada $ref ($sha). Anterior: ${previous:-ninguna}"
